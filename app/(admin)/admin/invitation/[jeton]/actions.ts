"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EtatAction } from "@/lib/admin/etat";
import { ecrireAudit } from "@/lib/audit";
import { accepterInvitation, CompteExistant, lireInvitation, problemeMotDePasse } from "@/lib/auth/comptes";

export async function accepter(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const jeton = String(donnees.get("jeton") ?? "");
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const inv = await lireInvitation(jeton);
  if (!inv) return { erreur: "Ce lien n’est plus valable." };
  if (motDePasse !== String(donnees.get("confirmation") ?? "")) return { erreurs: [{ chemin: "confirmation", message: "Les deux mots de passe diffèrent." }] };
  const probleme = problemeMotDePasse(motDePasse, inv.email);
  if (probleme) return { erreurs: [{ chemin: "motDePasse", libelle: "Mot de passe", message: probleme }] };
  let r;
  try {
    r = await accepterInvitation(jeton, motDePasse);
  } catch (e) {
    if (e instanceof CompteExistant) return { erreur: e.message };
    throw e;
  }
  if (!r) return { erreur: "Ce lien n’est plus valable." };
  await ecrireAudit({ utilisateurId: r.id, action: "compte.creer", cibleType: "utilisateur", cibleId: r.id, apres: { role: inv.role, par: "invitation" }, entetes: await headers() });
  redirect("/admin/connexion?invitation=1");
}
