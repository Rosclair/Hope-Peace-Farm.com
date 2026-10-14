// E-mail d’alerte de sécurité (brief §4) : envoyé quand le numéro WhatsApp, l’e-mail
// de notification ou un numéro de paiement change, à l’adresse de notification
// (l’ancienne et la nouvelle si c’est elle qui change) et aux propriétaires. Les
// valeurs y sont masquées. Mis en file, puis envoyé juste après la réponse.

import "server-only";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { utilisateur } from "@/lib/db/schema";
import { codeErreur, journal } from "@/lib/journal";
import { envoyerEmail, mettreEnFile } from "@/lib/mail/file";
import { adresseNotification } from "@/lib/reglages";

export async function alerteSecurite(args: { quoi: string[]; par: string; destinatairesEnPlus?: string[] }): Promise<void> {
  try {
    const notification = await adresseNotification();
    if (!notification) return; // SMTP non configuré : le journal d’audit garde la trace.
    const proprietaires = await db()
      .select({ email: utilisateur.email })
      .from(utilisateur)
      .where(and(eq(utilisateur.role, "proprietaire"), eq(utilisateur.actif, true)));
    const destinataires = [...new Set([notification, ...(args.destinatairesEnPlus ?? []), ...proprietaires.map((p) => p.email)].map((e) => e.toLowerCase()))];
    const le = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala", dateStyle: "full", timeStyle: "short" });
    const texte = [
      "Bonjour,",
      "",
      `Une modification sensible vient d’être faite dans le back-office de Hope & Peace Farm, le ${le} (heure de Douala), par ${args.par} :`,
      ...args.quoi.map((q) => `- ${q}`),
      "",
      "Si vous n’êtes pas à l’origine de ce changement : connectez-vous, vérifiez la valeur, changez votre mot de passe et révoquez les sessions inconnues (Sécurité).",
    ].join("\n");
    const ids: number[] = [];
    for (const destinataire of destinataires) {
      ids.push(await mettreEnFile({ type: "alerte_securite", destinataire, sujet: "Hope & Peace Farm — modification sensible", texte }));
    }
    after(async () => {
      for (const id of ids) await envoyerEmail(id).catch((e) => journal.erreur("alerte de sécurité", { email: id, erreur: codeErreur(e) }));
    });
  } catch (e) {
    journal.erreur("alerte de sécurité : mise en file impossible", { erreur: codeErreur(e) });
  }
}
