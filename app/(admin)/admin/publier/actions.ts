"use server";

// Publication et retour arrière depuis le back-office (brief §4.6). Mêmes fonctions
// que la ligne de commande (lib/contenu/depot.ts), puis revalidation du cache de la
// page : elle est à jour dès la requête suivante.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { EtatAction } from "@/lib/admin/etat";
import { libelleDe } from "@/lib/admin/libelles";
import { ecrireAudit } from "@/lib/audit";
import { exigerCompte } from "@/lib/auth/session";
import { ContenuRefuse, publier, restaurer, VerrouOccupe, VersionIntrouvable } from "@/lib/contenu/depot";
import { revaliderContenu } from "@/lib/contenu/revalidation";

function rafraichirAdmin() {
  revalidatePath("/admin/publier");
  revalidatePath("/admin/contenus");
  revalidatePath("/admin");
}

function refus(e: unknown): EtatAction {
  if (e instanceof ContenuRefuse) {
    return {
      erreur: "Publication refusée : corrigez d’abord ces points.",
      erreurs: e.problemes.filter((p) => p.bloquant).map((p) => ({ chemin: p.chemin, libelle: p.chemin ? libelleDe(p.chemin) : undefined, message: p.message })),
    };
  }
  if (e instanceof VerrouOccupe || e instanceof VersionIntrouvable) return { erreur: e.message };
  throw e;
}

export async function publierBrouillon(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const note = z.string().trim().max(200).catch("").parse(donnees.get("note") ?? "");
  let r;
  try {
    r = await publier({ par: compte.nom, note: note || undefined });
  } catch (e) {
    return refus(e);
  }
  if (r.statut === "inchangee") return { ok: `Rien à publier : le brouillon est identique à la version en ligne (n° ${r.numero}).` };
  await revaliderContenu();
  await ecrireAudit({ utilisateurId: compte.id, action: "contenu.publier", cibleType: "version", cibleId: String(r.numero), apres: { note: note || null, avertissements: r.avertissements.length }, entetes: await headers() });
  rafraichirAdmin();
  return {
    ok: `Version n° ${r.numero} publiée : la page publique est à jour.`,
    details: r.avertissements.length ? [`${r.avertissements.length} valeur(s) encore marquée(s) « à confirmer ».`] : undefined,
  };
}

export async function restaurerVersion(_e: EtatAction, donnees: FormData): Promise<EtatAction> {
  const compte = await exigerCompte("proprietaire");
  const analyse = z.object({ numero: z.coerce.number().int().min(1), confirmation: z.literal("1") }).safeParse(Object.fromEntries(donnees));
  if (!analyse.success) return { erreur: "Cochez la case de confirmation." };
  let r;
  try {
    r = await restaurer(analyse.data.numero, { par: compte.nom });
  } catch (e) {
    return refus(e);
  }
  if (r.statut === "inchangee") return { ok: `La version n° ${r.depuis} est déjà en ligne.` };
  await revaliderContenu();
  await ecrireAudit({
    utilisateurId: compte.id,
    action: "contenu.restaurer",
    cibleType: "version",
    cibleId: String(r.numero),
    apres: { depuis: r.depuis, modificationsRemplacees: r.modificationsRemplacees },
    entetes: await headers(),
  });
  rafraichirAdmin();
  return {
    ok: `Version n° ${r.depuis} remise en ligne (nouvelle version n° ${r.numero}).`,
    details: r.modificationsRemplacees ? ["Le brouillon contenait des modifications non publiées : il a été remis à cette version."] : undefined,
  };
}
