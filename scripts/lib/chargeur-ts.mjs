// À passer à Node avec --import : enregistre les crochets de scripts/lib/hooks-ts.mjs.
// Exemple : node --env-file-if-exists=.env --import ./scripts/lib/chargeur-ts.mjs scripts/contenu.mjs etat

import { register } from "node:module";

register("./hooks-ts.mjs", import.meta.url);
