// Contenu publié de la page. Phase 2 : le contenu initial (= maquette), en code.
// Phase 3 : lecture de la version en ligne en base, mise en cache et étiquetée
// pour être revalidée à la publication.

import { CONTENU_INITIAL } from "./initial";
import type { ContenuPage } from "./types";

export async function contenuPublie(): Promise<ContenuPage> {
  return CONTENU_INITIAL;
}
