// Après `next build` (script postbuild) : copie les fichiers statiques dans la
// sortie standalone, que `next build` ne copie pas lui-même. Permet de lancer
// en local exactement le serveur que Hostinger exécute (npm start).

import { cpSync, existsSync } from "node:fs";

const SORTIE = ".next/standalone";
if (!existsSync(SORTIE)) {
  console.error("Pas de sortie standalone : vérifier output: \"standalone\" dans next.config.mjs");
  process.exit(1);
}
cpSync(".next/static", `${SORTIE}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${SORTIE}/public`, { recursive: true });
console.log("Fichiers statiques copiés dans la sortie standalone.");
