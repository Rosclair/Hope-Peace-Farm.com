"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { alerteSecurite } from "@/lib/admin/alertes";
import type { EtatAction } from "@/lib/admin/etat";
import { ecrireAudit, masquerEmail } from "@/lib/audit";
import { verifierCodeSensible } from "@/lib/auth/connexion";
import { exigerCompte } from "@/lib/auth/session";
import { adresseNotification, conservationMois, ecrireReglage, SCHEMAS_REGLAGES } from "@/lib/reglages";

/** E-mail de notification : code TOTP, e-mail d’alerte (ancienne et nouvelle adresse), journal masqué. */
export async function changerEmailNotification(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const entetes = await headers();
  const email = SCHEMAS_REGLAGES.emailNotification.safeParse(String(donnees.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { erreurs: [{ chemin: "email", libelle: "E-mail de notification", message: "Adresse e-mail invalide." }] };
  const avant = await adresseNotification();
  if (avant === email.data) return { ok: "Adresse inchangée." };
  const probleme = await verifierCodeSensible(compte.id, String(donnees.get("code") ?? ""), entetes);
  if (probleme) return { erreurs: [{ chemin: "code", libelle: "Code de sécurité", message: probleme }] };
  await ecrireReglage("emailNotification", email.data, compte.id);
  await ecrireAudit({
    utilisateurId: compte.id,
    action: "reglage.modifier",
    cibleType: "reglage",
    cibleId: "emailNotification",
    avant: { emailNotification: avant ? masquerEmail(avant) : null },
    apres: { emailNotification: masquerEmail(email.data) },
    entetes,
  });
  await alerteSecurite({
    quoi: [`E-mail de notification : ${avant ? masquerEmail(avant) : "(aucun)"} → ${masquerEmail(email.data)}`],
    par: compte.nom,
    destinatairesEnPlus: avant ? [avant] : [],
  });
  revalidatePath("/admin/reglages");
  return { ok: "Adresse de notification enregistrée. Un e-mail d’alerte a été envoyé." };
}

export async function changerConservation(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const mois = z.coerce.number().pipe(SCHEMAS_REGLAGES.conservationMois).safeParse(donnees.get("mois"));
  if (!mois.success) return { erreurs: [{ chemin: "mois", libelle: "Durée de conservation", message: mois.error.issues[0]?.message ?? "Nombre de mois invalide." }] };
  const avant = await conservationMois();
  if (avant === mois.data) return { ok: "Durée inchangée." };
  await ecrireReglage("conservationMois", mois.data, compte.id);
  await ecrireAudit({ utilisateurId: compte.id, action: "reglage.modifier", cibleType: "reglage", cibleId: "conservationMois", avant: { conservationMois: avant }, apres: { conservationMois: mois.data }, entetes: await headers() });
  revalidatePath("/admin/reglages");
  return { ok: `Les demandes seront supprimées ${mois.data} mois après leur dernière mise à jour.` };
}
