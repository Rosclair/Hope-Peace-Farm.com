// Comparaison de jetons secrets en temps constant (cron, diagnostic).

import { createHash, timingSafeEqual } from "node:crypto";

const empreinte = (valeur: string) => createHash("sha256").update(valeur, "utf8").digest();

/** Vrai si `fourni` égale `attendu`, sans fuite de temps sur la longueur ni le contenu. */
export function jetonValide(fourni: string | null | undefined, attendu: string): boolean {
  if (!fourni || attendu.length === 0) return false;
  return timingSafeEqual(empreinte(fourni), empreinte(attendu));
}

/** Jeton porté par `Authorization: Bearer …`. */
export function jetonPorteur(entetes: Headers): string | null {
  const valeur = entetes.get("authorization");
  const correspondance = valeur?.match(/^Bearer\s+(\S+)$/i);
  return correspondance?.[1] ?? null;
}
