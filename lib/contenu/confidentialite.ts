// Phase 4 : les demandes sont enregistrées. Les textes de confidentialité de la
// maquette (« Rien n’est enregistré sur ce site », « Ce site n’enregistre aucune
// donnée personnelle ») deviennent faux. Le contenu initial porte le texte réécrit
// (docs/confidentialite-projet.md) ; ce module remplace les anciens textes dans un
// contenu déjà publié, et le contrôle de publication refuse qu’ils reviennent.

import { CONTENU_INITIAL } from "./initial";
import type { ContenuPage } from "./types";

const nbsp = (t: string) => t.replaceAll("~", " ");

/** Phrase courte sous les formulaires, dans la maquette. */
export const COURT_MAQUETTE = nbsp(
  "Rien n’est enregistré sur ce site~: votre message part seulement quand vous appuyez sur «~Envoyer~» dans WhatsApp.",
);
/** Premier paragraphe du bloc « Confidentialité », dans la maquette. */
export const PREMIER_PARAGRAPHE_MAQUETTE = nbsp(
  "Ce site n’enregistre aucune donnée personnelle. Les formulaires préparent un message dans votre navigateur~; rien ne nous est envoyé tant que vous n’avez pas appuyé sur «~Envoyer~» dans WhatsApp.",
);

/** Passages qui affirment que rien n’est enregistré : refusés à la publication. */
export const AFFIRMATIONS_PERIMEES = [/rien n’est enregistré/i, /n’enregistre aucune donnée/i, /rien ne nous est envoyé/i];

/**
 * Contenu dont les textes de confidentialité de la maquette sont remplacés par ceux
 * du contenu initial ; null s’il n’y a rien à remplacer (textes déjà modifiés).
 */
export function remplacerConfidentialiteMaquette(c: ContenuPage): ContenuPage | null {
  const court = c.demande.confidentialite === COURT_MAQUETTE;
  const bloc = c.confidentialite.paragraphes[0] === PREMIER_PARAGRAPHE_MAQUETTE;
  if (!court && !bloc) return null;
  return {
    ...c,
    demande: court ? { ...c.demande, confidentialite: CONTENU_INITIAL.demande.confidentialite } : c.demande,
    confidentialite: bloc ? CONTENU_INITIAL.confidentialite : c.confidentialite,
  };
}
