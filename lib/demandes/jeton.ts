// Lien de la page de confirmation sans JavaScript : /demande/confirmation?d=<jeton>.
// Le jeton porte la référence (aucune donnée personnelle) et son échéance (30 min),
// signés par HMAC : on ne peut ni deviner ni fabriquer le lien d’une autre demande.

import { createHmac } from "node:crypto";
import { jetonValide } from "@/lib/securite/jeton";
import { FORME_REFERENCE } from "./reference";

export const DUREE_JETON_MS = 30 * 60_000;

const signature = (charge: string, secret: string) =>
  createHmac("sha256", secret).update(`confirmation:${charge}`).digest("base64url").slice(0, 22);

export function signerConfirmation(reference: string, secret: string, maintenant = Date.now()): string {
  const charge = `${reference}.${(maintenant + DUREE_JETON_MS).toString(36)}`;
  return `${charge}.${signature(charge, secret)}`;
}

/** Référence portée par un jeton valide et non échu, sinon null. */
export function lireConfirmation(jeton: string | undefined, secret: string, maintenant = Date.now()): string | null {
  const morceaux = (jeton ?? "").split(".");
  if (morceaux.length !== 3) return null;
  const [reference = "", echeance = "", sig] = morceaux;
  if (!FORME_REFERENCE.test(reference)) return null;
  if (!jetonValide(sig, signature(`${reference}.${echeance}`, secret))) return null;
  const fin = parseInt(echeance, 36);
  return Number.isFinite(fin) && fin >= maintenant ? reference : null;
}
