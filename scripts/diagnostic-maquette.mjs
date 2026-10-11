#!/usr/bin/env node
// Diagnostic de performance mobile de la maquette : Lighthouse sur des copies
// dont on a retiré un ingrédient (logo, animations, landing épinglée…), pour
// mesurer la part de chacun dans le temps de blocage. L'original n'est jamais modifié.
// Usage : node scripts/diagnostic-maquette.mjs [--passages=2]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { demarrerServeur } from "./lib/serveur-statique.mjs";
import { VARIANTES } from "./lib/variantes-maquette.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const PASSAGES = Number(args.passages ?? 2);
const CHOIX = args.variantes ? args.variantes.split(",") : Object.keys(VARIANTES);
const dossier = join(tmpdir(), "hpf-variantes");
mkdirSync(dossier, { recursive: true });

const source = readFileSync(join(racine, "reference/hope-and-peace-farm-apercu-2.html"), "utf8");
for (const [nom, transformer] of Object.entries(VARIANTES)) {
  const html = transformer(source);
  if (nom !== "base" && html === source) throw new Error(`La variante « ${nom} » ne change rien`);
  writeFileSync(join(dossier, `${nom}.html`), html);
}

const mediane = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
const resultats = {};
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run"] });
try {
  for (const nom of CHOIX) {
    const serveur = await demarrerServeur(dossier, `${nom}.html`);
    const passages = [];
    for (let i = 0; i < PASSAGES; i++) {
      const { lhr } = await lighthouse(serveur.url, { port: chrome.port, logLevel: "error", onlyCategories: ["performance"] });
      const fil = Object.fromEntries(lhr.audits["mainthread-work-breakdown"].details.items.map((x) => [x.group, Math.round(x.duration)]));
      passages.push({
        performance: Math.round(lhr.categories.performance.score * 100),
        tbtMs: Math.round(lhr.audits["total-blocking-time"].numericValue),
        lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
        styleLayoutMs: fil.styleLayout ?? 0,
        renduMs: fil.paintCompositeRender ?? 0,
        scriptMs: fil.scriptEvaluation ?? 0,
      });
    }
    await serveur.close();
    resultats[nom] = {
      performance: mediane(passages.map((p) => p.performance)),
      tbtMs: mediane(passages.map((p) => p.tbtMs)),
      styleLayoutMs: mediane(passages.map((p) => p.styleLayoutMs)),
      passages,
    };
    const r = resultats[nom];
    console.log(`${nom.padEnd(17)} perf ${r.performance}  TBT ${r.tbtMs} ms  style+mise en page ${r.styleLayoutMs} ms`);
  }
} finally {
  await chrome.kill();
}
const fichier = join(racine, "reference/mesures/diagnostic.json");
let precedent = {};
try { precedent = JSON.parse(readFileSync(fichier, "utf8")).resultats ?? {}; } catch { /* premier passage */ }
writeFileSync(fichier, JSON.stringify({ date: new Date().toISOString(), passages: PASSAGES, resultats: { ...precedent, ...resultats } }, null, 2) + "\n");
