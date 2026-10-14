// Anti-spam sans service tiers (brief §3, architecture §6) : champ piège et délai
// minimal (dans la route), contrôle de l’origine, limites de débit en base par
// empreinte d’IP et par numéro. Ni l’adresse IP ni le numéro ne sont stockés en
// clair : empreinte HMAC-SHA-256 avec un sel qui change chaque jour (dérivé du
// secret des demandes et de la date, jamais stocké), tronquée à 128 bits.

import "server-only";
import { createHmac } from "node:crypto";
import { eq, and, lt, sql } from "drizzle-orm";
import { configDemandes } from "@/lib/config";
import { db } from "@/lib/db/client";
import { limiteDebit } from "@/lib/db/schema";
import { isoDouala } from "./schema";

/** Limites retenues : larges pour un visiteur réel, bloquantes pour un robot. */
export const LIMITES = {
  /** Envois par adresse IP et par heure (plusieurs visiteurs peuvent partager une adresse). */
  ipParHeure: 10,
  /** Demandes enregistrées par numéro WhatsApp et par jour. */
  numeroParJour: 3,
} as const;

/** Délai minimal (ms) entre la préparation du formulaire et l’envoi (moteur seulement). */
export const DELAI_MINIMAL_MS = 3000;

export function empreinte(valeur: string, secret: string, jour = isoDouala()): string {
  const sel = createHmac("sha256", secret).update(`sel:${jour}`).digest();
  return createHmac("sha256", sel).update(valeur).digest("hex").slice(0, 32);
}

/**
 * Adresse du visiteur d’après l’en-tête configuré. Chaque proxy ajoute l’adresse
 * de son client en fin de liste : avec `proxys` proxys de confiance, l’adresse
 * fiable est la `proxys`-ième en partant de la fin (les précédentes peuvent être
 * forgées par le visiteur).
 */
export function adresseVisiteur(entetes: Headers, entete: string, proxys: number): string | null {
  const brut = entetes.get(entete);
  if (!brut || proxys < 1) return null;
  const valeurs = brut
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return valeurs[Math.max(0, valeurs.length - proxys)] ?? null;
}

/**
 * Origine de la requête : l’en-tête Origin (envoyé par les navigateurs sur tout
 * POST) doit être celui du site ; à défaut, Sec-Fetch-Site doit indiquer la même
 * origine. Sans aucun des deux (très vieux navigateur, outil), la requête passe :
 * les limites de débit restent appliquées.
 */
export function origineValide(entetes: Headers, siteUrl: string): boolean {
  const origine = entetes.get("origin");
  if (origine && origine !== "null") {
    const permises = new Set([new URL(siteUrl).origin]);
    const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
    if (hote) {
      const proto = entetes.get("x-forwarded-proto") ?? new URL(siteUrl).protocol.replace(":", "");
      permises.add(`${proto}://${hote}`);
    }
    return permises.has(origine);
  }
  if (origine === "null") return false;
  const site = entetes.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

/** Incrémente le compteur d’une clé dans sa fenêtre et renvoie sa nouvelle valeur. */
async function compter(cle: string, fenetreDebut: Date): Promise<number> {
  await db()
    .insert(limiteDebit)
    .values({ cle, fenetreDebut, compteur: 1 })
    .onDuplicateKeyUpdate({ set: { compteur: sql`${limiteDebit.compteur} + 1` } });
  const [ligne] = await db()
    .select({ compteur: limiteDebit.compteur })
    .from(limiteDebit)
    .where(and(eq(limiteDebit.cle, cle), eq(limiteDebit.fenetreDebut, fenetreDebut)))
    .limit(1);
  return ligne?.compteur ?? 1;
}

const debutHeure = (t = Date.now()) => new Date(Math.floor(t / 36e5) * 36e5);
/** Début du jour de Douala (minuit à UTC+1), en UTC. */
const debutJourDouala = (t = Date.now()) => new Date(Date.parse(`${isoDouala(0, t)}T00:00:00+01:00`));

export type Limite = "ok" | "ip" | "numero";

/** Compte cet envoi et dit si une limite est dépassée (adresse d’abord, puis numéro). */
export async function appliquerLimites(ip: string | null, numero: string): Promise<Limite> {
  const secret = configDemandes().secret();
  if (ip && (await compter(`ip:${empreinte(ip, secret)}`, debutHeure())) > LIMITES.ipParHeure) return "ip";
  if ((await compter(`tel:${empreinte(numero, secret)}`, debutJourDouala())) > LIMITES.numeroParJour) return "numero";
  return "ok";
}

/** Purge des compteurs de plus de deux jours (tâche quotidienne). */
export async function purgerLimites(): Promise<number> {
  const [r] = await db()
    .delete(limiteDebit)
    .where(lt(limiteDebit.fenetreDebut, new Date(Date.now() - 2 * 864e5)));
  return r.affectedRows;
}
