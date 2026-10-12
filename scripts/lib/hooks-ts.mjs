// Crochets de chargement Node (module.register) pour exécuter le code TypeScript de
// lib/ depuis les scripts : alias « @/… », imports sans extension, transpilation par
// TypeScript (déjà en dépendance de développement) et « server-only » neutralisé.
// Utilisé par scripts/lib/chargeur-ts.mjs ; jamais par le serveur Next.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve as resoudreChemin } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = resoudreChemin(dirname(fileURLToPath(import.meta.url)), "../..");
const ts = createRequire(join(racine, "package.json"))("typescript");
const VIDE = "data:text/javascript,export {};";

function versFichier(base) {
  for (const f of [base, `${base}.ts`, join(base, "index.ts")]) {
    if (existsSync(f) && !f.endsWith("\\") && /\.(ts|mjs|js)$/.test(f)) return pathToFileURL(f).href;
  }
  return null;
}

export async function resolve(specifieur, contexte, suivant) {
  if (specifieur === "server-only") return { url: VIDE, shortCircuit: true };
  if (specifieur.startsWith("@/")) {
    const url = versFichier(join(racine, specifieur.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if ((specifieur.startsWith("./") || specifieur.startsWith("../")) && contexte.parentURL?.endsWith(".ts")) {
    const url = versFichier(resoudreChemin(dirname(fileURLToPath(contexte.parentURL)), specifieur));
    if (url) return { url, shortCircuit: true };
  }
  return suivant(specifieur, contexte);
}

export async function load(url, contexte, suivant) {
  if (url.endsWith(".ts")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return suivant(url, contexte);
}
