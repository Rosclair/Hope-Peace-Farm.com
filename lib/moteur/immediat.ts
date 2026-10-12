// Partie immédiate du moteur : tout ce qui ne touche qu’aux classes, attributs,
// propriétés et variables CSS d’éléments existants (Fêtes, menu, section en cours,
// barre fixe, détails, landing, en-tête, apparitions). Compilée en un script en ligne
// (scripts/construire-moteur.mjs → lib/site/moteur-immediat.ts), lue en fin de <body>
// comme le script de la maquette, elle démarre juste après la première image, sans
// attendre le JavaScript de Next.js : la landing réagit au défilement même sur un
// réseau lent (mesure : npm run site:demarrage).
//
// Sans risque pour l’hydratation : React 19 (production) ne compare ni ne corrige
// les attributs à l’hydratation et garde l’état des cases cochées ; il n’exige que des
// textes et une structure identiques, que cette partie ne modifie jamais. Les
// formulaires, qui écrivent des textes et des listes, démarrent après l’hydratation
// (lib/moteur/index.ts).

import { apparitions } from "./apparitions";
import { defilement } from "./defilement";
import { creerContexte } from "./outils";
import { barreFixe, details, fetes, menu, sectionCourante } from "./page";

declare global {
  interface Window {
    /** Posé par la partie immédiate du moteur : elle ne s’exécute qu’une fois. */
    __hpfMoteurImmediat?: boolean;
  }
}

export function demarrerImmediat(): void {
  if (window.__hpfMoteurImmediat) return;
  window.__hpfMoteurImmediat = true;
  const ctx = creerContexte();
  fetes(ctx);
  menu();
  sectionCourante(ctx);
  const majBarre = barreFixe(ctx);
  details();
  defilement(ctx, majBarre);
  apparitions(ctx);
}
