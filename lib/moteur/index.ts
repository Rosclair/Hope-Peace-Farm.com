// Moteur de la page, porté de reference/extrait/principal.js en TypeScript natif,
// sans dépendance ni état React. Deux temps :
//   1. partie immédiate (immediat.ts) : script en ligne en fin de <body>, exécuté
//      dès la lecture de la page, comme celui de la maquette (en production) ;
//   2. formulaires (demande.ts) : après l’hydratation, lancés une seule fois par
//      components/site/client/comportements.tsx.
// Sans JavaScript, la page reste lisible, le menu s’ouvre, les liens WhatsApp et
// téléphone fonctionnent, et la landing s’affiche à son état final.
//
// Écart avec la maquette : la section 7 (rappel en console, en local, des mentions
// légales « [… à renseigner] ») n’est pas reprise : le site masque ces lignes vides.

import { demande } from "./demande";
import { creerContexte } from "./outils";
import { compteFetes } from "./page";

let formulairesDemarres = false;

export async function demarrerApresHydratation(): Promise<void> {
  // Garde : le mode strict de React et les remontages ne doivent pas doubler les écouteurs.
  if (formulairesDemarres) return;
  formulairesDemarres = true;
  // En développement, la partie immédiate n’est pas en ligne (React signalerait les
  // attributs posés avant l’hydratation) : elle démarre ici. Code retiré en production.
  if (process.env.NODE_ENV !== "production" && !window.__hpfMoteurImmediat) {
    (await import("./immediat")).demarrerImmediat();
  }
  const ctx = creerContexte();
  demande(ctx);
  compteFetes(ctx);
}
