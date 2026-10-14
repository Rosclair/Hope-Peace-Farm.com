// Connexion au back-office en deux temps (architecture §9) : mot de passe, puis code
// TOTP (ou code de secours). Ce module ajoute à Better Auth :
//  - le verrouillage après 5 échecs consécutifs, mot de passe et code confondus
//    (lib/auth/verrouillage.ts), compté dans la table `utilisateur` ;
//  - une limite de débit par empreinte d’adresse (30 essais par heure) ;
//  - le journal d’audit (connexion réussie, échec, verrouillage).
// Les messages ne disent pas si l’adresse e-mail existe.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ecrireAudit } from "@/lib/audit";
import { configAuth, configSite } from "@/lib/config";
import { db } from "@/lib/db/client";
import { utilisateur } from "@/lib/db/schema";
import { compter, debutHeure } from "@/lib/demandes/antispam";
import { auth, empreinteIp } from "./serveur";
import { dureeVerrou, minutesRestantes } from "./verrouillage";

export const ESSAIS_PAR_HEURE = 30;
const COOKIE_ATTENTE = "hpf_attente";
const ATTENTE_SECONDES = 600;

export type ResultatEtape =
  | { statut: "code" }
  | { statut: "activer" }
  | { statut: "connecte" }
  | { statut: "erreur"; message: string };

const MESSAGE_IDENTIFIANTS = "E-mail ou mot de passe incorrect.";
const MESSAGE_CODE = "Code incorrect ou expiré.";
const messageVerrou = (jusqua: Date) =>
  `Trop d’essais : le compte est verrouillé. Réessayez dans ${minutesRestantes(jusqua)} min.`;
const MESSAGE_DEBIT = "Trop d’essais depuis cette connexion. Réessayez dans une heure.";

// ---------------------------------------------------------------------------
// Compte en attente du second facteur (cookie signé, 10 min) : permet de compter
// les échecs de code sur le bon compte.

function signer(valeur: string): string {
  return createHmac("sha256", configAuth().AUTH_SECRET).update(`attente:${valeur}`).digest("base64url");
}

async function poserAttente(utilisateurId: string): Promise<void> {
  const expire = Date.now() + ATTENTE_SECONDES * 1000;
  const valeur = `${utilisateurId}.${expire}`;
  (await cookies()).set(COOKIE_ATTENTE, `${valeur}.${signer(valeur)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: configSite().SITE_URL.startsWith("https:"),
    path: "/admin",
    maxAge: ATTENTE_SECONDES,
  });
}

export async function lireAttente(): Promise<string | null> {
  await connection();
  const brut = (await cookies()).get(COOKIE_ATTENTE)?.value;
  const m = brut?.match(/^([0-9a-f-]{36})\.(\d+)\.([\w-]+)$/);
  if (!m) return null;
  const [, id, expire, signature] = m as unknown as [string, string, string, string];
  const attendue = Buffer.from(signer(`${id}.${expire}`));
  const fournie = Buffer.from(signature);
  if (attendue.length !== fournie.length || !timingSafeEqual(attendue, fournie)) return null;
  return Number(expire) > Date.now() ? id : null;
}

async function effacerAttente(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_ATTENTE, path: "/admin" });
}

// ---------------------------------------------------------------------------

interface EtatCompte {
  id: string;
  actif: boolean;
  verrouilleJusqua: Date | null;
  deuxFacteurs: boolean;
}

async function trouver(where: ReturnType<typeof eq>): Promise<EtatCompte | null> {
  const [u] = await db()
    .select({ id: utilisateur.id, actif: utilisateur.actif, verrouilleJusqua: utilisateur.verrouilleJusqua, deuxFacteurs: utilisateur.twoFactorEnabled })
    .from(utilisateur)
    .where(where)
    .limit(1);
  return u ?? null;
}

const verrouille = (u: EtatCompte | null): u is EtatCompte & { verrouilleJusqua: Date } =>
  Boolean(u?.verrouilleJusqua && u.verrouilleJusqua.getTime() > Date.now());

/** Compte un échec ; verrouille le compte au 5ᵉ échec consécutif et au-delà. */
async function noterEchec(u: EtatCompte | null, entetes: Headers, motif: string): Promise<Date | null> {
  if (!u) {
    await ecrireAudit({ utilisateurId: null, action: "connexion.echec", apres: { motif: "compte inconnu" }, entetes });
    return null;
  }
  await db()
    .update(utilisateur)
    .set({ echecsConnexion: sql`${utilisateur.echecsConnexion} + 1` })
    .where(eq(utilisateur.id, u.id));
  const [ligne] = await db().select({ echecs: utilisateur.echecsConnexion }).from(utilisateur).where(eq(utilisateur.id, u.id));
  const duree = dureeVerrou(ligne?.echecs ?? 0);
  let jusqua: Date | null = null;
  if (duree > 0) {
    jusqua = new Date(Date.now() + duree);
    await db().update(utilisateur).set({ verrouilleJusqua: jusqua }).where(eq(utilisateur.id, u.id));
  }
  await ecrireAudit({
    utilisateurId: u.id,
    action: jusqua ? "connexion.verrouillage" : "connexion.echec",
    cibleType: "utilisateur",
    cibleId: u.id,
    apres: { motif, echecs: ligne?.echecs ?? null, verrouilleJusqua: jusqua?.toISOString() ?? null },
    entetes,
  });
  return jusqua;
}

async function noterSucces(utilisateurId: string, entetes: Headers): Promise<void> {
  await db().update(utilisateur).set({ echecsConnexion: 0, verrouilleJusqua: null }).where(eq(utilisateur.id, utilisateurId));
  await ecrireAudit({ utilisateurId, action: "connexion.reussie", cibleType: "utilisateur", cibleId: utilisateurId, entetes });
}

async function debitDepasse(entetes: Headers): Promise<boolean> {
  const ip = empreinteIp(entetes);
  if (!ip) return false;
  return (await compter(`auth:${ip}`, debutHeure())) > ESSAIS_PAR_HEURE;
}

/** Étape 1 : e-mail et mot de passe. */
export async function etapeMotDePasse(email: string, motDePasse: string, entetes: Headers): Promise<ResultatEtape> {
  if (await debitDepasse(entetes)) return { statut: "erreur", message: MESSAGE_DEBIT };
  const u = await trouver(eq(utilisateur.email, email.toLowerCase()));
  if (verrouille(u)) return { statut: "erreur", message: messageVerrou(u.verrouilleJusqua) };
  if (u && !u.actif) {
    await ecrireAudit({ utilisateurId: u.id, action: "connexion.echec", apres: { motif: "compte désactivé" }, entetes });
    return { statut: "erreur", message: MESSAGE_IDENTIFIANTS };
  }

  let reponse: unknown;
  try {
    reponse = await auth().api.signInEmail({ body: { email, password: motDePasse, rememberMe: true }, headers: entetes });
  } catch {
    const jusqua = await noterEchec(u, entetes, "mot de passe");
    return { statut: "erreur", message: jusqua ? messageVerrou(jusqua) : MESSAGE_IDENTIFIANTS };
  }
  if (!u) return { statut: "erreur", message: MESSAGE_IDENTIFIANTS };
  if (reponse && typeof reponse === "object" && "twoFactorRedirect" in reponse) {
    await poserAttente(u.id);
    return { statut: "code" };
  }
  // Pas encore de second facteur : session ouverte, activation du TOTP imposée.
  await noterSucces(u.id, entetes);
  return { statut: "activer" };
}

/** Étape 2 : code de l’application (6 chiffres) ou code de secours. */
export async function etapeCode(code: string, entetes: Headers): Promise<ResultatEtape> {
  if (await debitDepasse(entetes)) return { statut: "erreur", message: MESSAGE_DEBIT };
  const id = await lireAttente();
  if (!id) return { statut: "erreur", message: "Délai dépassé : reprenez la connexion depuis le début." };
  const u = await trouver(eq(utilisateur.id, id));
  if (!u || !u.actif) return { statut: "erreur", message: "Délai dépassé : reprenez la connexion depuis le début." };
  if (verrouille(u)) return { statut: "erreur", message: messageVerrou(u.verrouilleJusqua) };

  const nettoye = code.replace(/\s+/g, "");
  try {
    if (/^\d{6}$/.test(nettoye)) {
      await auth().api.verifyTOTP({ body: { code: nettoye, trustDevice: false }, headers: entetes });
    } else {
      await auth().api.verifyBackupCode({ body: { code: nettoye, trustDevice: false }, headers: entetes });
      await ecrireAudit({ utilisateurId: u.id, action: "securite.code_secours_utilise", cibleType: "utilisateur", cibleId: u.id, entetes });
    }
  } catch {
    const jusqua = await noterEchec(u, entetes, "code");
    return { statut: "erreur", message: jusqua ? messageVerrou(jusqua) : MESSAGE_CODE };
  }
  await effacerAttente();
  await noterSucces(u.id, entetes);
  return { statut: "connecte" };
}

/**
 * Ressaisie du code TOTP pour une action sensible (numéro WhatsApp, e-mail de
 * notification, numéros de paiement). Les échecs comptent pour le verrouillage.
 */
export async function verifierCodeSensible(utilisateurId: string, code: string, entetes: Headers): Promise<string | null> {
  const u = await trouver(eq(utilisateur.id, utilisateurId));
  if (!u) return MESSAGE_CODE;
  if (verrouille(u)) return messageVerrou(u.verrouilleJusqua);
  const nettoye = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(nettoye)) return "Saisissez le code à 6 chiffres de votre application.";
  try {
    await auth().api.verifyTOTP({ body: { code: nettoye }, headers: entetes });
  } catch {
    const jusqua = await noterEchec(u, entetes, "code (action sensible)");
    return jusqua ? messageVerrou(jusqua) : MESSAGE_CODE;
  }
  await db().update(utilisateur).set({ echecsConnexion: 0 }).where(eq(utilisateur.id, utilisateurId));
  return null;
}
