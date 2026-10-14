// QR code en SVG, généré côté serveur (bibliothèque uqr, pur JavaScript, sans dépendance).

import { renderSVG } from "uqr";

export function qrSvg(texte: string): string {
  return renderSVG(texte, { ecc: "M", border: 2 });
}

/** Secret en clair d’une adresse otpauth://, par groupes de 4, pour une saisie à la main. */
export function secretLisible(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
