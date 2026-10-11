#!/usr/bin/env node
// Mesures du site en cours d’exécution (local ou en ligne) :
//   - poids du HTML et du JavaScript client : transférés, décompressés et estimés en brotli ;
//   - Lighthouse mobile (réglages par défaut) et ordinateur, médiane de la performance.
// Usage : node scripts/mesures-site.mjs <url> [--passages=3] [--sortie=fichier.json]

import { writeFileSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import { brotliCompressSync } from "node:zlib";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const option = (nom, defaut) => args.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1] ?? defaut;
if (!url) {
  console.error("Usage : node scripts/mesures-site.mjs <url> [--passages=3] [--sortie=fichier.json]");
  process.exit(2);
}
const PASSAGES = Number(option("passages", 3));
const resultats = { url, date: new Date().toISOString(), poids: {}, lighthouse: {} };

// ---------- Poids transférés ----------
async function taille(adresse) {
  const r = await fetch(adresse, { headers: { "accept-encoding": "br, gzip" } });
  const corps = Buffer.from(await r.arrayBuffer());
  // fetch décompresse : la taille transférée vient de Content-Length quand il est présent
  // (absent en envoi par morceaux) ; « brotli » estime ce qu’enverrait un serveur qui le gère.
  const transfere = Number(r.headers.get("content-length")) || null;
  return { statut: r.status, encodage: r.headers.get("content-encoding"), transfere, decompresse: corps.length, brotli: brotliCompressSync(corps).length, texte: corps.toString("utf8") };
}
const page = await taille(url);
// Les scripts « nomodule » (polyfills) ne sont pas téléchargés par les navigateurs modernes.
const balises = [...page.texte.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)];
const estNomodule = (balise) => /\snomodule[\s=>]/i.test(balise);
const scripts = [...new Set(balises.filter((m) => !estNomodule(m[0])).map((m) => m[1]))];
const nomodule = balises.filter((m) => estNomodule(m[0])).map((m) => m[1]);
const js = [];
for (const src of scripts) {
  const t = await taille(new URL(src, url).href);
  js.push({ src, encodage: t.encodage, transfere: t.transfere, decompresse: t.decompresse, brotli: t.brotli });
}
const enLigne = [...page.texte.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("");
resultats.poids = {
  html: { encodage: page.encodage, transfere: page.transfere, decompresse: page.decompresse, brotli: page.brotli },
  jsFichiers: js,
  jsTotalDecompresse: js.reduce((s, f) => s + f.decompresse, 0),
  jsTotalTransfere: js.every((f) => f.transfere) ? js.reduce((s, f) => s + f.transfere, 0) : null,
  jsTotalBrotli: js.reduce((s, f) => s + f.brotli, 0),
  jsEnLigneDecompresse: Buffer.byteLength(enLigne),
  jsNomoduleIgnores: nomodule,
};
console.log(`HTML : ${page.decompresse} o (${page.encodage ?? "non compressé"}) · JS client : ${js.length} fichier(s), ${resultats.poids.jsTotalDecompresse} o décompressés, ${resultats.poids.jsTotalTransfere ?? "?"} o transférés, ${resultats.poids.jsTotalBrotli} o en brotli · JS en ligne : ${resultats.poids.jsEnLigneDecompresse} o`);

// ---------- Lighthouse ----------
const mediane = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"] });
try {
  for (const [forme, config] of [["mobile", undefined], ["ordinateur", desktopConfig]]) {
    const passages = [];
    for (let i = 0; i < PASSAGES; i++) {
      const { lhr } = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", locale: "fr" }, config);
      if (lhr.runtimeError) {
        console.log(`Lighthouse ${forme} #${i + 1} : erreur ${lhr.runtimeError.code} — ${lhr.runtimeError.message}`);
        continue;
      }
      const score = (c) => Math.round((lhr.categories[c]?.score ?? 0) * 100);
      const num = (a) => lhr.audits[a]?.numericValue;
      const p = {
        performance: score("performance"),
        accessibilite: score("accessibility"),
        bonnesPratiques: score("best-practices"),
        seo: score("seo"),
        fcpMs: Math.round(num("first-contentful-paint")),
        lcpMs: Math.round(num("largest-contentful-paint")),
        tbtMs: Math.round(num("total-blocking-time")),
        cls: Number(num("cumulative-layout-shift").toFixed(4)),
        mainThreadMs: Object.fromEntries((lhr.audits["mainthread-work-breakdown"]?.details?.items ?? []).map((x) => [x.group, Math.round(x.duration)])),
        echecs: Object.values(lhr.audits)
          .filter((a) => a.score !== null && a.score < 1 && ["binary", "numeric"].includes(a.scoreDisplayMode) && Object.values(lhr.categories).some((c) => c.id !== "performance" && c.auditRefs.some((r) => r.id === a.id && r.weight > 0)))
          .map((a) => `${a.id} : ${a.title}`),
      };
      passages.push(p);
      console.log(`Lighthouse ${forme} #${i + 1} : perf ${p.performance} · a11y ${p.accessibilite} · BP ${p.bonnesPratiques} · SEO ${p.seo} · FCP ${p.fcpMs} ms · LCP ${p.lcpMs} ms · TBT ${p.tbtMs} ms · CLS ${p.cls}${p.echecs.length ? " · échecs : " + p.echecs.join(" ; ") : ""}`);
    }
    const perf = passages.length ? mediane(passages.map((p) => p.performance)) : null;
    resultats.lighthouse[forme] = { medianePerformance: perf, passages };
  }
} finally {
  await chrome.kill();
}

const sortie = option("sortie");
if (sortie) {
  writeFileSync(sortie, JSON.stringify(resultats, null, 2) + "\n");
  console.log(`→ ${sortie}`);
}
