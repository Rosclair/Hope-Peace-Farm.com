// Contrôle des routes techniques protégées par un secret partagé (cron,
// diagnostic). Sans secret configuré, l’accès est toujours refusé.

import "server-only";
import { configSecrets } from "@/lib/config";
import { jetonPorteur, jetonValide } from "./jeton";

export type Secret = "CRON_SECRET" | "DIAGNOSTIC_SECRET";

export function accesAutorise(requete: Request, secret: Secret, { jetonDansUrl = false } = {}): boolean {
  let attendu: string;
  try {
    attendu = configSecrets()[secret];
  } catch {
    return false;
  }
  const fourni = jetonPorteur(requete.headers) ?? (jetonDansUrl ? new URL(requete.url).searchParams.get("jeton") : null);
  return jetonValide(fourni, attendu);
}

export const SANS_CACHE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;
