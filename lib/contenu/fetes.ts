// État des Fêtes selon la date à Douala (UTC+1, sans heure d’été), même règle que le
// script de tête de la maquette : après la date de fin, « fetes-fin » (bandeau et bloc
// masqués) ; sinon, avant la date limite, « fetes-garanti » (phrase du prix garanti).
//
// Le serveur pose ces classes au rendu, pour que la page soit juste aussi sans
// JavaScript (écart voulu avec la maquette, qui n’affiche jamais la garantie sans
// JavaScript). La page est régénérée au plus toutes les 30 s (PROFIL_CONTENU) : la
// bascule de minuit est donc visible dans la minute, sans tâche dédiée.

import { cacheLife } from "next/cache";
import { PROFIL_CONTENU } from "./profil";

/** Date du jour à Douala, AAAA-MM-JJ. */
export function dateDouala(maintenant = Date.now()): string {
  return new Date(maintenant + 36e5).toISOString().slice(0, 10);
}

export function etatFetes(f: { actif: boolean; dateLimitePrixGaranti: string; dateFin: string }, aujourdhui: string) {
  if (!f.actif) return { fin: false, garanti: false };
  if (f.dateFin && aujourdhui > f.dateFin) return { fin: true, garanti: false };
  return { fin: false, garanti: Boolean(f.dateLimitePrixGaranti) && aujourdhui < f.dateLimitePrixGaranti };
}

/** Classes des Fêtes pour <html>, calculées à la date du rendu (mises en cache 30 s à 5 min). */
export async function classesFetes(actif: boolean, dateLimitePrixGaranti: string, dateFin: string): Promise<string> {
  "use cache";
  cacheLife(PROFIL_CONTENU);
  const e = etatFetes({ actif, dateLimitePrixGaranti, dateFin }, dateDouala());
  return e.fin ? "fetes-fin" : e.garanti ? "fetes-garanti" : "";
}
