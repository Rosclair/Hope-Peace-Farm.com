// Revalidation du cache après une publication ou un retour arrière. Utilisée par
// POST /api/contenu/revalider (ligne de commande) et, en phase 5, par les actions
// serveur du back-office.
//
// Deux constats mesurés sur Next 16.4 (npm run test:e2e, tests/e2e/publication.test.ts) :
//  1. revalidateTag(…, { expire: 0 }) seul laisse servir une fois l’ancienne page
//     (« STALE ») pendant sa régénération : revalidatePath("/"), sans profil, l’expire
//     vraiment ;
//  2. Next écrit l’entrée de cache d’une page après avoir répondu. Une régénération
//     commencée juste avant la publication (donc avec l’ancien contenu) peut finir
//     d’écrire après la revalidation, et paraître plus récente qu’elle. D’où une seconde
//     revalidation, une fois ces écritures terminées.

import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { ETIQUETTE_CONTENU } from "./profil";

/** Délai couvrant une régénération en cours (rendu et écriture du cache). */
export const DELAI_SECONDE_REVALIDATION_MS = 2000;

function invalider(): void {
  revalidateTag(ETIQUETTE_CONTENU, { expire: 0 });
  revalidatePath("/");
}

/** Invalide tout de suite, puis de nouveau après le délai ; se termine après la seconde. */
export async function revaliderContenu(): Promise<void> {
  invalider();
  await new Promise((fin) => setTimeout(fin, DELAI_SECONDE_REVALIDATION_MS));
  invalider();
}
