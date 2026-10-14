"use server";

// Enregistrement d’un groupe de contenus dans le brouillon (brief §4.4) : chaque
// valeur est revalidée par le schéma Zod du contenu, sous verrou optimiste. Les
// champs sensibles (numéro WhatsApp, numéros de paiement) exigent le code TOTP,
// déclenchent un e-mail d’alerte et sont masqués au journal d’audit.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { alerteSecurite } from "@/lib/admin/alertes";
import { cheminPremierNiveau, champsDuGroupe, ecrireChemin, feuilles, GROUPES, lireChemin } from "@/lib/admin/champs";
import type { EtatAction } from "@/lib/admin/etat";
import { CHAMPS_SENSIBLES, libelleDe } from "@/lib/admin/libelles";
import { ecrireAudit, valeurJournal } from "@/lib/audit";
import { verifierCodeSensible } from "@/lib/auth/connexion";
import { exigerCompte } from "@/lib/auth/session";
import { ConflitBrouillon, ContenuRefuse, enregistrerBrouillon, lireBrouillon } from "@/lib/contenu/depot";
import { schemaContenu } from "@/lib/contenu/schema";

export interface EtatEditeur extends EtatAction {
  revision?: number;
  aConfirmer?: string[];
}

const cheminDe = (segments: readonly PropertyKey[]) =>
  segments.reduce<string>((acc, s) => (typeof s === "number" ? `${acc}[${s}]` : acc ? `${acc}.${String(s)}` : String(s)), "");

export async function enregistrerGroupe(_e: EtatEditeur, donnees: FormData): Promise<EtatEditeur> {
  const compte = await exigerCompte("proprietaire");
  const entetes = await headers();
  const groupe = String(donnees.get("_groupe") ?? "");
  const revision = Number(donnees.get("_revision"));
  if (!GROUPES.includes(groupe as (typeof GROUPES)[number]) || !Number.isInteger(revision)) return { erreur: "Formulaire invalide : rechargez la page." };

  const brouillon = await lireBrouillon();
  if (!brouillon) return { erreur: "Contenu non initialisé." };
  if (brouillon.revision !== revision) {
    return { erreur: "Le brouillon a été modifié entre-temps (autre onglet ou autre personne). Rechargez la page avant d’enregistrer." };
  }

  // Valeurs saisies → nouveau document (seuls les champs du groupe sont lus).
  const champs = feuilles(champsDuGroupe(groupe, lireChemin(brouillon.donnees, groupe)));
  const valeurs: Record<string, string> = {};
  let document = brouillon.donnees;
  const changes: { chemin: string; avant: unknown; apres: unknown }[] = [];
  for (const c of champs) {
    let v: unknown;
    if (c.genre === "booleen") {
      v = donnees.get(c.chemin) === "1";
      valeurs[c.chemin] = v ? "1" : "";
    } else {
      const brut = String(donnees.get(c.chemin) ?? "").replace(/\r\n?/g, "\n");
      valeurs[c.chemin] = brut;
      v = c.genre === "entier" ? (brut.trim() === "" ? Number.NaN : Number(brut.trim().replace(/[\s  ]/g, ""))) : brut;
    }
    const avant = lireChemin(brouillon.donnees, c.chemin);
    if (!Object.is(avant, v) && avant !== v) changes.push({ chemin: c.chemin, avant, apres: v });
    document = ecrireChemin(document, c.chemin, v);
  }

  // Marques « à confirmer » du groupe (cases cochées), les autres sont gardées.
  const cochees = new Set(donnees.getAll("_confirmer").map(String));
  const proposes = new Set(champs.map((c) => cheminPremierNiveau(c.chemin)));
  const aConfirmer = [...brouillon.aConfirmer.filter((p) => !proposes.has(p)), ...[...proposes].filter((p) => cochees.has(p))];
  const ajoutes = aConfirmer.filter((p) => !brouillon.aConfirmer.includes(p));
  const retires = brouillon.aConfirmer.filter((p) => !aConfirmer.includes(p));

  if (!changes.length && !ajoutes.length && !retires.length) return { ok: "Aucune modification.", revision, valeurs, aConfirmer };

  // Validation complète du document ; erreurs rapportées au champ.
  const analyse = schemaContenu.safeParse(document);
  if (!analyse.success) {
    const erreurs = analyse.error.issues.map((i) => {
      const chemin = cheminDe(i.path);
      return { chemin, libelle: libelleDe(chemin), message: i.message };
    });
    return { erreurs, valeurs, revision, aConfirmer };
  }

  // Champs sensibles : code TOTP obligatoire.
  const sensibles = changes.filter((c) => (CHAMPS_SENSIBLES as readonly string[]).includes(c.chemin));
  if (sensibles.length) {
    const probleme = await verifierCodeSensible(compte.id, String(donnees.get("_code") ?? ""), entetes);
    if (probleme) {
      return {
        erreurs: [{ chemin: "_code", libelle: "Code de sécurité", message: `${probleme} Il est demandé pour changer : ${sensibles.map((s) => libelleDe(s.chemin)).join(", ")}.` }],
        valeurs,
        revision,
        aConfirmer,
      };
    }
  }

  let nouvelle: number;
  try {
    ({ revision: nouvelle } = await enregistrerBrouillon({ donnees: analyse.data, aConfirmer, revisionAttendue: revision, par: compte.nom }));
  } catch (e) {
    if (e instanceof ConflitBrouillon) return { erreur: e.message, valeurs, revision, aConfirmer };
    if (e instanceof ContenuRefuse) return { erreurs: e.problemes.map((p) => ({ chemin: p.chemin, libelle: libelleDe(p.chemin), message: p.message })), valeurs, revision, aConfirmer };
    throw e;
  }

  const audit = changes.slice(0, 60);
  await ecrireAudit({
    utilisateurId: compte.id,
    action: "contenu.modifier",
    cibleType: "groupe",
    cibleId: groupe,
    avant: Object.fromEntries(audit.map((c) => [c.chemin, valeurJournal(c.chemin, c.avant)])),
    apres: {
      ...Object.fromEntries(audit.map((c) => [c.chemin, valeurJournal(c.chemin, c.apres)])),
      ...(ajoutes.length || retires.length ? { aConfirmer: { ajoutes, retires } } : {}),
      ...(changes.length > audit.length ? { autres: changes.length - audit.length } : {}),
    },
    entetes,
  });
  if (sensibles.length) {
    await alerteSecurite({
      quoi: sensibles.map((s) => `${libelleDe(s.chemin)} : ${String(valeurJournal(s.chemin, s.avant) || "(vide)")} → ${String(valeurJournal(s.chemin, s.apres) || "(vide)")}`),
      par: compte.nom,
    });
  }

  revalidatePath("/admin/contenus");
  revalidatePath("/admin/publier");
  revalidatePath("/admin");
  return {
    ok: `Enregistré dans le brouillon (${changes.length} modification${changes.length > 1 ? "s" : ""}). La page publique change seulement après « Publier ».`,
    revision: nouvelle,
    valeurs,
    aConfirmer,
  };
}
