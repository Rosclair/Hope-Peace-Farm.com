// Référence d’une demande : HP-AAMMJJ-XXXXXX (date de Douala, six caractères tirés
// au hasard par crypto.randomInt dans un alphabet sans 0, O, 1 ni I, faciles à
// confondre à l’oral ou sur WhatsApp). 32⁶ ≈ 1 milliard de combinaisons par jour ;
// l’unicité est garantie par l’index de la base (nouveau tirage en cas de collision).

import { randomInt } from "node:crypto";

export const ALPHABET_REFERENCE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const FORME_REFERENCE = /^HP-\d{6}-[2-9A-HJ-NP-Z]{6}$/;

export function nouvelleReference(maintenant = Date.now()): string {
  const jour = new Date(maintenant + 36e5).toISOString().slice(2, 10).replace(/-/g, "");
  let suffixe = "";
  for (let i = 0; i < 6; i++) suffixe += ALPHABET_REFERENCE[randomInt(ALPHABET_REFERENCE.length)];
  return `HP-${jour}-${suffixe}`;
}
