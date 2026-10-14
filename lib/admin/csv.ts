// Export CSV pour un tableur (brief §4.3) : UTF-8 avec BOM (Excel reconnaît les
// accents), point-virgule comme séparateur (réglage français), fins de ligne CRLF,
// formules neutralisées : une cellule qui commence par = + - @, une tabulation ou un
// retour chariot est précédée d’une apostrophe (injection de formules, OWASP).

export const BOM = "﻿";
const SEPARATEUR = ";";

export function cellule(valeur: unknown): string {
  let texte = valeur === null || valeur === undefined ? "" : valeur instanceof Date ? valeur.toISOString() : String(valeur);
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return /[";\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

export function versCsv(entetes: readonly string[], lignes: readonly (readonly unknown[])[]): string {
  return BOM + [entetes, ...lignes].map((l) => l.map(cellule).join(SEPARATEUR)).join("\r\n") + "\r\n";
}
