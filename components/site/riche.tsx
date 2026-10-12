// Rendu React des textes riches du contenu (voir lib/contenu/reperes.ts).
// Les numéros de téléphone prennent la classe `tel` de la maquette : <span class="tel">,
// ou <strong class="tel"> quand le gras ne contient que le numéro.

import type { ReactNode } from "react";
import { analyser, textePlat, valeurRepere, type Morceau } from "@/lib/contenu/reperes";
import type { ContenuPage } from "@/lib/contenu/types";

export interface Rendu {
  /** Texte riche → nœuds React. */
  r: (texte: string) => ReactNode;
  /** Texte riche → texte brut (attributs). */
  plat: (texte: string) => string;
}

/**
 * Fusionne les chaînes voisines : un seul nœud de texte, comme dans la maquette.
 * (Chrome met en forme chaque nœud à part : des nœuds découpés décalent le texte
 * de quelques centièmes de pixel.)
 */
function fusionner(noeuds: ReactNode[]): ReactNode[] {
  const sortie: ReactNode[] = [];
  for (const n of noeuds) {
    const dernier = sortie.length - 1;
    if (typeof n === "string" && typeof sortie[dernier] === "string") sortie[dernier] += n;
    else if (n !== "") sortie.push(n);
  }
  return sortie;
}

export function rendu(contenu: ContenuPage): Rendu {
  const noeuds = (morceaux: Morceau[], cle: string): ReactNode[] =>
    fusionner(morceaux.map((m, i) => {
      const k = `${cle}${i}`;
      switch (m.type) {
        case "texte":
          return m.texte;
        case "repere": {
          const v = valeurRepere(contenu, m.chemin);
          return v.telephone ? <span className="tel" key={k}>{v.texte}</span> : v.texte;
        }
        case "gras": {
          const seul = m.morceaux.length === 1 ? m.morceaux[0] : undefined;
          if (seul?.type === "repere") {
            const v = valeurRepere(contenu, seul.chemin);
            if (v.telephone) return <strong className="tel" key={k}>{v.texte}</strong>;
          }
          return <strong key={k}>{noeuds(m.morceaux, `${k}-`)}</strong>;
        }
        case "lien":
          return <a href={m.ancre} key={k}>{noeuds(m.morceaux, `${k}-`)}</a>;
      }
    }));
  return {
    r: (texte) => noeuds(analyser(texte), "m"),
    plat: (texte) => textePlat(contenu, texte),
  };
}
