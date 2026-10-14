"use server";

// Sécurité du compte et équipe (architecture §9) : mot de passe, codes de secours,
// sessions actives, invitations et désactivation des membres (propriétaire).

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { EtatAction } from "@/lib/admin/etat";
import { ecrireAudit, masquerEmail } from "@/lib/audit";
import {
  annulerInvitation,
  changerActivation,
  CompteExistant,
  creerInvitation,
  INVITATION_JOURS,
  nombreProprietaires,
  problemeMotDePasse,
  revoquerSession,
  sessionsActives,
} from "@/lib/auth/comptes";
import { exigerCompte } from "@/lib/auth/session";
import { auth } from "@/lib/auth/serveur";
import { configSite } from "@/lib/config";
import { db } from "@/lib/db/client";
import { utilisateur } from "@/lib/db/schema";
import { envoyerEmail, mettreEnFile } from "@/lib/mail/file";
import { adresseNotification } from "@/lib/reglages";
import { codeErreur, journal } from "@/lib/journal";

export async function changerMotDePasse(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const actuel = String(donnees.get("actuel") ?? "");
  const nouveau = String(donnees.get("nouveau") ?? "");
  if (nouveau !== String(donnees.get("confirmation") ?? "")) return { erreurs: [{ chemin: "confirmation", libelle: "Confirmation", message: "Les deux mots de passe diffèrent." }] };
  const probleme = problemeMotDePasse(nouveau, compte.email);
  if (probleme) return { erreurs: [{ chemin: "nouveau", libelle: "Nouveau mot de passe", message: probleme }] };
  const entetes = await headers();
  try {
    await auth().api.changePassword({ body: { currentPassword: actuel, newPassword: nouveau, revokeOtherSessions: true }, headers: entetes });
  } catch {
    return { erreurs: [{ chemin: "actuel", libelle: "Mot de passe actuel", message: "Mot de passe incorrect." }] };
  }
  await ecrireAudit({ utilisateurId: compte.id, action: "securite.mot_de_passe", cibleType: "utilisateur", cibleId: compte.id, entetes });
  revalidatePath("/admin/securite");
  return { ok: "Mot de passe changé. Vos autres sessions ont été fermées." };
}

export async function nouveauxCodes(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const entetes = await headers();
  try {
    const r = await auth().api.generateBackupCodes({ body: { password: String(donnees.get("motDePasse") ?? "") }, headers: entetes });
    await ecrireAudit({ utilisateurId: compte.id, action: "securite.codes_regeneres", cibleType: "utilisateur", cibleId: compte.id, entetes });
    return { ok: "Nouveaux codes de secours (notez-les, ils ne seront plus affichés ; les anciens ne marchent plus) :", details: r.backupCodes };
  } catch {
    return { erreur: "Mot de passe incorrect." };
  }
}

export async function revoquer(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const entetes = await headers();
  const cible = String(donnees.get("session") ?? "");
  let n = 0;
  if (cible === "autres") {
    for (const s of await sessionsActives(compte.id)) if (s.id !== compte.sessionId && (await revoquerSession(compte.id, s.id))) n++;
  } else if (cible && cible !== compte.sessionId && (await revoquerSession(compte.id, cible))) n = 1;
  if (!n) return { ok: "Aucune session à fermer." };
  await ecrireAudit({ utilisateurId: compte.id, action: "session.revoquer", cibleType: "session", cibleId: cible === "autres" ? undefined : cible, apres: { sessions: n }, entetes });
  revalidatePath("/admin/securite");
  return { ok: n > 1 ? `${n} sessions fermées.` : "Session fermée." };
}

// ---------------------------------------------------------------------------
// Équipe (propriétaire)

export async function inviter(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const analyse = z
    .object({ email: z.email().max(254), nom: z.string().trim().min(1).max(100), role: z.enum(["equipe", "proprietaire"]) })
    .safeParse({ email: String(donnees.get("email") ?? "").trim().toLowerCase(), nom: donnees.get("nom"), role: donnees.get("role") });
  if (!analyse.success) return { erreur: "Nom et adresse e-mail valides obligatoires." };
  let jeton: string;
  try {
    jeton = await creerInvitation({ ...analyse.data, par: compte.id });
  } catch (e) {
    if (e instanceof CompteExistant) return { erreur: e.message };
    throw e;
  }
  const lien = new URL(`/admin/invitation/${jeton}`, configSite().SITE_URL).toString();
  await ecrireAudit({ utilisateurId: compte.id, action: "compte.inviter", cibleType: "invitation", apres: { email: masquerEmail(analyse.data.email), role: analyse.data.role }, entetes: await headers() });
  // E-mail d’invitation (si le SMTP est configuré) ; le lien est aussi affiché, à transmettre autrement.
  if (await adresseNotification()) {
    try {
      const id = await mettreEnFile({
        type: "invitation",
        destinataire: analyse.data.email,
        sujet: "Invitation au back-office de Hope & Peace Farm",
        texte: [
          `Bonjour ${analyse.data.nom},`,
          "",
          `${compte.nom} vous invite au back-office du site Hope & Peace Farm.`,
          `Choisissez votre mot de passe ici (lien valable ${INVITATION_JOURS} jours, à usage unique) :`,
          lien,
          "",
          "Il vous faudra aussi une application d’authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator…).",
        ].join("\n"),
      });
      await envoyerEmail(id);
    } catch (e) {
      journal.erreur("invitation : e-mail non envoyé", { erreur: codeErreur(e) });
    }
  }
  revalidatePath("/admin/securite");
  return { ok: "Invitation créée. Transmettez ce lien à la personne (valable 7 jours, à usage unique) :", details: [lien] };
}

export async function annuler(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const id = z.uuid().safeParse(donnees.get("invitation"));
  if (!id.success) return { erreur: "Invitation inconnue." };
  await annulerInvitation(id.data);
  await ecrireAudit({ utilisateurId: compte.id, action: "compte.annuler_invitation", cibleType: "invitation", cibleId: id.data, entetes: await headers() });
  revalidatePath("/admin/securite");
  return { ok: "Invitation annulée." };
}

export async function activation(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const analyse = z.object({ utilisateur: z.uuid(), actif: z.enum(["0", "1"]), confirmation: z.literal("1") }).safeParse(Object.fromEntries(donnees));
  if (!analyse.success) return { erreur: "Cochez la case de confirmation." };
  const { utilisateur: id, actif } = analyse.data;
  if (id === compte.id) return { erreur: "Vous ne pouvez pas désactiver votre propre compte." };
  const [cible] = await db().select({ role: utilisateur.role, actif: utilisateur.actif }).from(utilisateur).where(eq(utilisateur.id, id)).limit(1);
  if (!cible) return { erreur: "Compte inconnu." };
  if (actif === "0" && cible.role === "proprietaire" && (await nombreProprietaires()) <= 1) return { erreur: "Il faut au moins un propriétaire actif." };
  await changerActivation(id, actif === "1");
  await ecrireAudit({ utilisateurId: compte.id, action: "compte.activation", cibleType: "utilisateur", cibleId: id, avant: { actif: cible.actif }, apres: { actif: actif === "1" }, entetes: await headers() });
  revalidatePath("/admin/securite");
  return { ok: actif === "1" ? "Compte réactivé." : "Compte désactivé : ses sessions sont fermées." };
}
