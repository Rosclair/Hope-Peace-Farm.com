// Textes riches du contenu : repères {groupe.cle}, **gras** et [libellé](#ancre).
// L’analyse produit une liste de morceaux, rendue en React (components/site/riche.tsx)
// ou en texte brut (attributs, JSON-LD). Un repère inconnu est une erreur : en
// phase 3, il bloquera la publication.

import { dateLongue, fcfa, nombre, telephoneAffiche } from "./format";
import type { ContenuPage } from "./types";

type FormatRepere = "texte" | "nombre" | "prix" | "date" | "telephone";

/** Repères autorisés dans les textes, et leur mise en forme. */
export const REPERES: Readonly<Record<string, FormatRepere>> = {
  "coordonnees.whatsapp": "telephone",
  "coordonnees.telephone": "telephone",
  "coordonnees.emailContact": "texte",
  "coordonnees.adresse": "texte",
  "horaires.debut": "texte",
  "horaires.fin": "texte",
  "delais.reponse": "texte",
  "delais.devis": "texte",
  "prix.vivant": "prix",
  "prix.pretACuire": "prix",
  "prix.decoupe": "prix",
  "conditions.acomptePourcent": "nombre",
  "conditions.soldeJoursAvant": "nombre",
  "conditions.minimumCeremonie": "nombre",
  "conditions.minimumHorsNde": "nombre",
  "conditions.seuilRemboursementJours": "nombre",
  "conditions.seuilConserveJours": "nombre",
  "conditions.avoirMois": "nombre",
  "conditions.prixFixeSemaines": "nombre",
  "conditions.factureApresMois": "nombre",
  "conditions.factureJours": "nombre",
  "conditions.toleranceGrammes": "nombre",
  "conditions.revisionAlimentPourcent": "nombre",
  "conditions.preavisSemaines": "nombre",
  "paiement.nomCompte": "texte",
  "paiement.mtn": "telephone",
  "paiement.orange": "telephone",
  "fetes.dateLimitePrixGaranti": "date",
  "fetes.dateFin": "date",
  "fetes.clotureNoel": "date",
  "fetes.clotureNouvelAn": "date",
};

export class RepereInconnu extends Error {
  constructor(readonly chemin: string) {
    super(`Repère inconnu : {${chemin}}`);
    this.name = "RepereInconnu";
  }
}

export interface ValeurRepere {
  texte: string;
  /** Numéro de téléphone : affiché avec la classe `tel` (chiffres tabulaires, sans coupure). */
  telephone: boolean;
}

export function valeurRepere(contenu: ContenuPage, chemin: string): ValeurRepere {
  const format = REPERES[chemin];
  if (!format) throw new RepereInconnu(chemin);
  const [groupe, cle] = chemin.split(".") as [keyof ContenuPage, string];
  const brute = (contenu[groupe] as unknown as Record<string, unknown>)[cle];
  switch (format) {
    case "prix":
      return { texte: fcfa(Number(brute)), telephone: false };
    case "nombre":
      return { texte: nombre(Number(brute)), telephone: false };
    case "date":
      return { texte: dateLongue(String(brute)), telephone: false };
    case "telephone":
      return { texte: telephoneAffiche(String(brute)), telephone: true };
    default:
      return { texte: String(brute ?? ""), telephone: false };
  }
}

export type Morceau =
  | { type: "texte"; texte: string }
  | { type: "repere"; chemin: string }
  | { type: "gras"; morceaux: Morceau[] }
  | { type: "lien"; ancre: string; morceaux: Morceau[] };

const MARQUES = /\*\*(.+?)\*\*|\[([^\]]+)\]\((#[a-z0-9-]+)\)|\{([a-zA-Z]+\.[a-zA-Z]+)\}/g;
const REPERE = /\{([a-zA-Z]+\.[a-zA-Z]+)\}/g;

function morceauxSimples(texte: string): Morceau[] {
  const sortie: Morceau[] = [];
  let curseur = 0;
  for (const m of texte.matchAll(REPERE)) {
    if (m.index > curseur) sortie.push({ type: "texte", texte: texte.slice(curseur, m.index) });
    sortie.push({ type: "repere", chemin: m[1]! });
    curseur = m.index + m[0].length;
  }
  if (curseur < texte.length) sortie.push({ type: "texte", texte: texte.slice(curseur) });
  return sortie;
}

/** Découpe un texte riche en morceaux (le gras et les liens ne s’imbriquent pas). */
export function analyser(texte: string): Morceau[] {
  const sortie: Morceau[] = [];
  let curseur = 0;
  for (const m of texte.matchAll(MARQUES)) {
    if (m.index > curseur) sortie.push({ type: "texte", texte: texte.slice(curseur, m.index) });
    if (m[1] !== undefined) sortie.push({ type: "gras", morceaux: morceauxSimples(m[1]) });
    else if (m[2] !== undefined) sortie.push({ type: "lien", ancre: m[3]!, morceaux: morceauxSimples(m[2]) });
    else sortie.push({ type: "repere", chemin: m[4]! });
    curseur = m.index + m[0].length;
  }
  if (curseur < texte.length) sortie.push({ type: "texte", texte: texte.slice(curseur) });
  return sortie;
}

/** Repères cités par un texte (pour les contrôles de publication). */
export function reperesCites(texte: string): string[] {
  return [...texte.matchAll(REPERE)].map((m) => m[1]!);
}

/** Texte brut, repères remplacés, marques retirées (attributs, JSON-LD, messages). */
export function textePlat(contenu: ContenuPage, texte: string): string {
  const plat = (morceaux: Morceau[]): string =>
    morceaux
      .map((m) => {
        switch (m.type) {
          case "texte":
            return m.texte;
          case "repere":
            return valeurRepere(contenu, m.chemin).texte;
          default:
            return plat(m.morceaux);
        }
      })
      .join("");
  return plat(analyser(texte));
}
