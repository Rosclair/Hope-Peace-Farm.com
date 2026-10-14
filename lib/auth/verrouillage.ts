// Verrouillage après des échecs de connexion (architecture §9) : 5 échecs consécutifs
// (mot de passe ou code) verrouillent le compte 15 minutes ; chaque nouvel échec
// après un déverrouillage double la durée, jusqu’à 24 heures. Une connexion réussie
// remet le compteur à zéro.

export const ECHECS_AVANT_VERROU = 5;
const BASE_MS = 15 * 60_000;
const MAX_MS = 24 * 3600_000;

/** Durée du verrou après `echecs` échecs consécutifs (0 : pas de verrou). */
export function dureeVerrou(echecs: number): number {
  if (echecs < ECHECS_AVANT_VERROU) return 0;
  return Math.min(MAX_MS, BASE_MS * 2 ** (echecs - ECHECS_AVANT_VERROU));
}

/** Minutes restantes, arrondies au-dessus (pour le message). */
export function minutesRestantes(jusqua: Date, maintenant = Date.now()): number {
  return Math.max(1, Math.ceil((jusqua.getTime() - maintenant) / 60_000));
}
