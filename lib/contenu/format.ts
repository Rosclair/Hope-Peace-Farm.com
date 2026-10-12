// Mise en forme des valeurs affichées, à la française de la maquette :
// espaces insécables (U+00A0) entre les milliers, avant « FCFA » et après le
// jour d’une date (« 1er novembre 2026 »). Pas d’Intl : selon les moteurs, il
// produit des espaces fines (U+202F) que la maquette n’emploie pas.

const NBSP = " ";

export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

/** 340000 → « 340 000 » (espaces insécables). */
export function nombre(n: number): string {
  const [entier, decimales] = String(Math.abs(n)).split(".");
  const groupes = (entier ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${n < 0 ? "-" : ""}${groupes}${decimales ? `,${decimales}` : ""}`;
}

/** 3400 → « 3 400 FCFA ». */
export function fcfa(n: number): string {
  return `${nombre(n)}${NBSP}FCFA`;
}

/** « 2026-11-01 » → « 1er novembre 2026 » (espace insécable après le jour). */
export function dateLongue(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Date invalide : ${iso}`);
  const [, a, mo, j] = m;
  const jour = Number(j);
  const mois = MOIS[Number(mo) - 1];
  if (!mois || jour < 1 || jour > 31) throw new Error(`Date invalide : ${iso}`);
  return `${jour === 1 ? "1er" : jour}${NBSP}${mois} ${a}`;
}

/** Chiffres seuls d’un numéro (« +237 693… » → « 237693… »). */
export function chiffres(numero: string): string {
  return numero.replace(/\D/g, "");
}

/**
 * Numéro affiché : « 237693645565 » ou « +237693645565 » → « +237 693 64 55 65 ».
 * Numéros camerounais (237 + 9 chiffres) groupés comme la maquette ; les autres
 * sont affichés en un bloc, précédés de « + ».
 */
export function telephoneAffiche(numero: string): string {
  const c = chiffres(numero);
  const cm = /^237(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(c);
  if (cm) return ["+237", ...cm.slice(1)].join(NBSP);
  return `+${c}`;
}

/** Lien « tel: » : « +237693645565 ». */
export function lienTelephone(numero: string): string {
  return `tel:+${chiffres(numero)}`;
}
