"use server";

// Actions sur les demandes : Propriétaire et Équipe (brief §4, rôles). Chaque action
// relit la session, valide l’entrée (Zod) et écrit au journal d’audit, sans donnée
// du client (référence et statuts seulement).

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ajouterEvenement,
  changerStatut,
  corrigerDemande,
  DemandeIntrouvable,
  demandesDuNumero,
  lireDemande,
  supprimerClient,
} from "@/lib/admin/demandes";
import type { EtatAction } from "@/lib/admin/etat";
import { ecrireAudit } from "@/lib/audit";
import { exigerCompte } from "@/lib/auth/session";
import { STATUTS_DEMANDE } from "@/lib/db/schema";
import { normaliserNumero } from "@/lib/demandes/numero";
import { lienWa } from "@/lib/whatsapp/messages";

const reference = z.string().regex(/^HP-\d{6}-[A-Z0-9]{6}$/);

function rafraichir(ref: string) {
  revalidatePath(`/admin/demandes/${ref}`);
  revalidatePath("/admin/demandes");
  revalidatePath("/admin");
}

export async function modifierStatut(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const analyse = z
    .object({ reference, statut: z.enum(STATUTS_DEMANDE), texte: z.string().trim().max(1000).optional().default("") })
    .safeParse(Object.fromEntries(donnees));
  if (!analyse.success) return { erreur: "Statut invalide." };
  const { reference: ref, statut, texte } = analyse.data;
  try {
    const avant = await changerStatut(ref, statut, compte.id, texte);
    if (!avant) return { ok: "Statut inchangé." };
    await ecrireAudit({ utilisateurId: compte.id, action: "demande.statut", cibleType: "demande", cibleId: ref, avant: { statut: avant }, apres: { statut }, entetes: await headers() });
  } catch (e) {
    if (e instanceof DemandeIntrouvable) return { erreur: e.message };
    throw e;
  }
  rafraichir(ref);
  return { ok: "Statut enregistré." };
}

export async function ajouterNote(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const analyse = z.object({ reference, texte: z.string().trim().min(1).max(2000) }).safeParse(Object.fromEntries(donnees));
  if (!analyse.success) return { erreur: "Écrivez la note (2 000 caractères au plus)." };
  try {
    await ajouterEvenement(analyse.data.reference, "note", compte.id, analyse.data.texte);
  } catch (e) {
    if (e instanceof DemandeIntrouvable) return { erreur: e.message };
    throw e;
  }
  // La note peut contenir des données du client : le journal n’en garde que le fait.
  await ecrireAudit({ utilisateurId: compte.id, action: "demande.note", cibleType: "demande", cibleId: analyse.data.reference, entetes: await headers() });
  rafraichir(analyse.data.reference);
  return { ok: "Note ajoutée.", envoi: Date.now() };
}

export async function corriger(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const analyse = z
    .object({ reference, nom: z.string().trim().min(1).max(100), whatsapp: z.string().max(40) })
    .safeParse(Object.fromEntries(donnees));
  if (!analyse.success) return { erreur: "Nom obligatoire (100 caractères au plus)." };
  const numero = normaliserNumero(analyse.data.whatsapp);
  if (!numero) return { erreurs: [{ chemin: "whatsapp", libelle: "Numéro WhatsApp", message: "Numéro invalide." }] };
  try {
    const changes = await corrigerDemande(analyse.data.reference, { nom: analyse.data.nom, whatsappE164: numero }, compte.id);
    if (!changes.length) return { ok: "Rien à corriger." };
    await ecrireAudit({ utilisateurId: compte.id, action: "demande.corriger", cibleType: "demande", cibleId: analyse.data.reference, apres: { champs: changes }, entetes: await headers() });
  } catch (e) {
    if (e instanceof DemandeIntrouvable) return { erreur: e.message };
    throw e;
  }
  rafraichir(analyse.data.reference);
  return { ok: "Correction enregistrée." };
}

/** « Écrire sur WhatsApp » : note le contact dans l’historique, puis ouvre WhatsApp. */
export async function ecrireWhatsapp(donnees: FormData): Promise<void> {
  const compte = await exigerCompte();
  const ref = reference.safeParse(donnees.get("reference"));
  if (!ref.success) redirect("/admin/demandes");
  const d = await lireDemande(ref.data);
  if (!d) redirect("/admin/demandes");
  await ajouterEvenement(ref.data, "contact_whatsapp", compte.id, null);
  await ecrireAudit({ utilisateurId: compte.id, action: "demande.whatsapp", cibleType: "demande", cibleId: ref.data, entetes: await headers() });
  const prenom = d.type === "pro" ? d.nom.replace(/\s*\(.*\)$/, "") : d.nom;
  const message = `Bonjour ${prenom}, ici Hope & Peace Farm, au sujet de votre demande ${d.reference}.`;
  redirect(lienWa(d.whatsappE164.replace(/^\+/, ""), message));
}

/** Recherche par numéro avant suppression : mène à la page de confirmation. */
export async function chercherClient(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  await exigerCompte();
  const numero = normaliserNumero(String(donnees.get("numero") ?? ""));
  if (!numero) return { erreur: "Numéro invalide." };
  const [premiere] = await demandesDuNumero(numero);
  if (!premiere) return { erreur: "Aucune demande avec ce numéro." };
  redirect(`/admin/demandes/supprimer?ref=${premiere.reference}`);
}

/** Droit à l’effacement : toutes les demandes du numéro, après confirmation. */
export async function confirmerSuppressionClient(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte();
  const analyse = z.object({ reference, confirmation: z.literal("1") }).safeParse(Object.fromEntries(donnees));
  if (!analyse.success) return { erreur: "Cochez la case de confirmation." };
  const d = await lireDemande(analyse.data.reference);
  if (!d) return { erreur: "Demande introuvable : déjà supprimée ?" };
  const nombre = await supprimerClient(d.whatsappE164);
  // Journalisé sans la donnée supprimée : le nombre de demandes seulement.
  await ecrireAudit({ utilisateurId: compte.id, action: "demande.supprimer_client", cibleType: "client", apres: { demandes: nombre }, entetes: await headers() });
  revalidatePath("/admin/demandes");
  revalidatePath("/admin");
  redirect(`/admin/demandes?supprimees=${nombre}`);
}
