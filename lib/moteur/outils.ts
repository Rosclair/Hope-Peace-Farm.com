// Outils communs du moteur (reference/extrait/principal.js, en-tête du script).

export const $ = <E extends Element = HTMLElement>(sel: string, ctx: ParentNode = document): E | null =>
  ctx.querySelector<E>(sel);
export const $$ = <E extends Element = HTMLElement>(sel: string, ctx: ParentNode = document): E[] =>
  Array.from(ctx.querySelectorAll<E>(sel));

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Date du jour à Douala (UTC+1, sans heure d’été), décalée de `jours`, au format AAAA-MM-JJ. */
export const isoDouala = (jours = 0) => new Date(Date.now() + 36e5 + jours * 864e5).toISOString().slice(0, 10);

/** sessionStorage s’il est utilisable (navigation privée, stockage bloqué : null). */
function stockageSession(): Storage | null {
  try {
    const k = "__hpf";
    sessionStorage.setItem(k, k);
    sessionStorage.removeItem(k);
    return sessionStorage;
  } catch {
    return null;
  }
}

export interface Contexte {
  racine: HTMLElement;
  /** Numéro WhatsApp : un seul endroit, l’attribut data-wa de <html>. */
  wa: string;
  aujourdhui: string;
  dateMax: string;
  aIO: boolean;
  mouvementReduit: MediaQueryList;
  sauver: (cle: string, valeur: unknown) => void;
  lire: <T>(cle: string) => T | null;
}

export function creerContexte(): Contexte {
  const racine = document.documentElement;
  const stockage = stockageSession();
  return {
    racine,
    wa: (racine.dataset.wa ?? "").replace(/[^0-9A-Za-z]/g, ""),
    aujourdhui: isoDouala(),
    dateMax: isoDouala(365),
    aIO: "IntersectionObserver" in window,
    mouvementReduit: window.matchMedia("(prefers-reduced-motion: reduce)"),
    sauver: (cle, valeur) => {
      try {
        stockage?.setItem(cle, JSON.stringify(valeur));
      } catch {
        /* stockage plein ou bloqué */
      }
    },
    lire: <T,>(cle: string) => {
      try {
        return stockage ? (JSON.parse(stockage.getItem(cle) ?? "null") as T | null) : null;
      } catch {
        return null;
      }
    },
  };
}
