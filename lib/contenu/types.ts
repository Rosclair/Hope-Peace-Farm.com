// Types du document de contenu, déduits du schéma Zod (lib/contenu/schema.ts) :
// une seule définition pour la validation et le code.
//
// Les textes « riches » acceptent trois marques, et rien d’autre :
//   {groupe.cle}      valeur mise en forme au rendu (prix, date, numéro…), voir reperes.ts ;
//   **texte**         gras ;
//   [libellé](#ancre) lien vers une ancre de la page.
// Les libellés des formulaires, les messages WhatsApp pré-remplis, le menu et
// les ancres restent dans le code (mesure, tests et comportements en dépendent).

import type { z } from "zod";
import type { ICONES, schemaContenu } from "./schema";

export type ContenuPage = z.infer<typeof schemaContenu>;

/** Texte qui peut contenir des repères `{…}`, du **gras** et des liens d’ancre. */
export type TexteRiche = string;

/** Date au format AAAA-MM-JJ (jour calendaire à Douala). */
export type DateIso = string;

export type Icone = (typeof ICONES)[number];

export type Formule = ContenuPage["ceremonies"]["formules"]["liste"][number];
