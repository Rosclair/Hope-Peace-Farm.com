// Contrôles avant publication (brief §4.6, architecture §10). Bloquants : schéma
// invalide, champ obligatoire vide, « […] » à remplacer, repère inconnu, marque
// incomplète, lien vers une ancre qui n’existe pas. Non bloquants : valeurs encore
// marquées « à confirmer » (la première publication reprend la maquette, R10).
// Phase 6 : photos sans texte alternatif et avis sans accord écrit (bloquants).

import { analyser, REPERES, textePlat, type Morceau } from "./reperes";
import { schemaContenu } from "./schema";
import type { ContenuPage } from "./types";

/** Ancres de la page, seules cibles permises pour les liens [libellé](#ancre). */
export const ANCRES = new Set([
  "#accueil", "#contenu", "#ceremonies", "#formules", "#exemple", "#distance", "#poulets", "#fetes",
  "#professionnels", "#livraison", "#zones", "#paiement", "#payer", "#la-ferme", "#engagements",
  "#questions", "#demande", "#devis", "#commande", "#essai", "#nous-trouver", "#mentions-legales",
  "#confidentialite",
]);

export interface Probleme {
  /** Chemin du champ, ex. « prix.vivant » ou « questions.groupes[0].questions[2].reponse ». */
  chemin: string;
  message: string;
  bloquant: boolean;
}

export interface ResultatControle {
  /** Contenu validé (absent si le schéma refuse le document). */
  contenu?: ContenuPage;
  problemes: Probleme[];
  publiable: boolean;
}

const cheminDe = (segments: readonly PropertyKey[]) =>
  segments.reduce<string>((acc, s) => (typeof s === "number" ? `${acc}[${s}]` : acc ? `${acc}.${String(s)}` : String(s)), "");

/** Toutes les chaînes d’un document, avec leur chemin. */
export function chaines(valeur: unknown, chemin = ""): [string, string][] {
  if (typeof valeur === "string") return [[chemin, valeur]];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => chaines(v, `${chemin}[${i}]`));
  if (valeur && typeof valeur === "object") {
    return Object.entries(valeur).flatMap(([k, v]) => chaines(v, chemin ? `${chemin}.${k}` : k));
  }
  return [];
}

/** Vrai si le chemin (ex. « livraison.zones », « prix.vivant ») existe dans le document. */
export function cheminExiste(document: unknown, chemin: string): boolean {
  let courant: unknown = document;
  for (const segment of chemin.match(/[^.[\]]+/g) ?? []) {
    if (courant === null || typeof courant !== "object" || !(segment in courant)) return false;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return true;
}

function controlerTexte(contenu: ContenuPage, chemin: string, texte: string): Probleme[] {
  const problemes: Probleme[] = [];
  const bloquant = (message: string) => problemes.push({ chemin, message, bloquant: true });
  const morceaux = analyser(texte);
  const visiter = (liste: Morceau[]) => {
    for (const m of liste) {
      if (m.type === "repere" && !(m.chemin in REPERES)) bloquant(`Repère inconnu : {${m.chemin}}.`);
      if (m.type === "lien" && !ANCRES.has(m.ancre)) bloquant(`Lien vers une ancre inexistante : ${m.ancre}.`);
      if (m.type === "gras" || m.type === "lien") visiter(m.morceaux);
    }
  };
  visiter(morceaux);
  if (problemes.length) return problemes;
  // Ce qui reste après rendu ne doit plus contenir de marque.
  const rendu = textePlat(contenu, texte);
  if (/\[[^\]]*\]/.test(rendu)) bloquant("Texte entre crochets à remplacer (« […] »).");
  else if (/\*\*|[{}]/.test(rendu)) bloquant("Marque incomplète : « ** », « { » ou « } » sans sa fin.");
  return problemes;
}

/** Contrôle complet d’un document et de sa liste « à confirmer ». */
export function controlerPublication(donnees: unknown, aConfirmer: readonly string[] = []): ResultatControle {
  const analyse = schemaContenu.safeParse(donnees);
  if (!analyse.success) {
    const problemes = analyse.error.issues.map((i) => ({ chemin: cheminDe(i.path), message: i.message, bloquant: true }));
    return { problemes, publiable: false };
  }
  const contenu = analyse.data;
  const problemes = chaines(contenu).flatMap(([chemin, texte]) => controlerTexte(contenu, chemin, texte));
  for (const chemin of aConfirmer) {
    problemes.push(
      cheminExiste(contenu, chemin)
        ? { chemin, message: "Valeur encore marquée « à confirmer ».", bloquant: false }
        : { chemin, message: "Marque « à confirmer » sur un champ qui n’existe plus.", bloquant: false },
    );
  }
  return { contenu, problemes, publiable: !problemes.some((p) => p.bloquant) };
}
