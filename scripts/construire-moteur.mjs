#!/usr/bin/env node
// Compile la partie immédiate du moteur (lib/moteur/immediat.ts et ses imports) en un
// seul script, exécuté en ligne en fin de <body> comme celui de la maquette : il agit
// dès la lecture de la page, sans attendre le JavaScript de Next.js ni l’hydratation.
// Sortie : lib/site/moteur-immediat.ts (généré, versionné ; un test vérifie qu’il est à jour).
//
// Outils déjà présents : TypeScript (transpilation, module par module) et le terser
// fourni avec Next.js (minification). Petit regroupeur maison : les modules sont
// enveloppés dans des fonctions, comme CommonJS, puis l’entrée est exécutée.
// Usage : node scripts/construire-moteur.mjs [--verifier]

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(racine, "package.json"));
const ts = require("typescript");
const { minify } = require("next/dist/compiled/terser");

const ENTREE = "lib/moteur/immediat.ts";
const SORTIE = "lib/site/moteur-immediat.ts";

/** Résout un import (« ./x », « @/lib/x ») vers un fichier .ts du projet. */
function resoudre(depuis, specifieur) {
  const base = specifieur.startsWith("@/") ? join(racine, specifieur.slice(2)) : resolve(dirname(depuis), specifieur);
  for (const f of [`${base}.ts`, join(base, "index.ts")]) {
    try {
      readFileSync(f);
      return f;
    } catch {
      /* suivant */
    }
  }
  throw new Error(`Import introuvable : ${specifieur} (depuis ${relative(racine, depuis)})`);
}

const modules = new Map();
function charger(fichier) {
  const id = relative(racine, fichier).replaceAll("\\", "/");
  if (modules.has(id)) return id;
  modules.set(id, null);
  const source = readFileSync(fichier, "utf8");
  const sortie = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, importHelpers: false, esModuleInterop: false },
    fileName: fichier,
  }).outputText;
  const dependances = {};
  for (const m of sortie.matchAll(/require\("([^"]+)"\)/g)) dependances[m[1]] = charger(resoudre(fichier, m[1]));
  modules.set(id, { code: sortie, dependances });
  return id;
}

const entree = charger(join(racine, ENTREE));
const corps = [...modules.entries()]
  .map(
    ([id, { code, dependances }]) =>
      `${JSON.stringify(id)}: [function (exports, require) {\n${code}\n}, ${JSON.stringify(dependances)}]`,
  )
  .join(",\n");
const regroupe = `(function () {
var M = {${corps}};
var C = {};
function charger(id) {
  if (C[id]) return C[id].exports;
  var m = (C[id] = { exports: {} });
  M[id][0](m.exports, function (s) { return charger(M[id][1][s]); });
  return m.exports;
}
// Après la première image : le premier affichage n’attend pas le calcul de mise en page
// du moteur (la maquette, elle, agit aussi après son premier affichage).
function demarrer() { charger(${JSON.stringify(entree)}).demarrerImmediat(); }
if (window.requestAnimationFrame) requestAnimationFrame(function () { setTimeout(demarrer, 0); });
else demarrer();
})();`;

const { code } = await minify(regroupe, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
if (!code || /<\/script/i.test(code)) throw new Error("Script vide ou contenant « </script »");

const fichier = [
  "// Fichier généré par scripts/construire-moteur.mjs depuis lib/moteur/immediat.ts : ne pas modifier",
  "// à la main (npm run moteur:construire). En ligne en fin de <body> ; démarre après la première image.",
  "",
  `export const MOTEUR_IMMEDIAT = ${JSON.stringify(code)};`,
  "",
].join("\n");

if (process.argv.includes("--verifier")) {
  const actuel = readFileSync(join(racine, SORTIE), "utf8");
  if (actuel !== fichier) {
    console.error(`${SORTIE} n’est pas à jour : lancer npm run moteur:construire`);
    process.exit(1);
  }
  console.log(`${SORTIE} est à jour.`);
} else {
  writeFileSync(join(racine, SORTIE), fichier);
  console.log(`${SORTIE} : ${modules.size} modules, ${code.length} octets (${[...modules.keys()].join(", ")})`);
}
