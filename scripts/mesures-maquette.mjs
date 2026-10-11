#!/usr/bin/env node
// Mesures de référence de la maquette :
//   - Lighthouse, mobile (réglages par défaut : Moto G Power, 4G lente simulée)
//     et ordinateur, 3 passages chacun, médiane de la performance ;
//   - axe-core (WCAG 2.2 A et AA) avec JavaScript, à 393 et 1 280 px ;
//   - poids transférés (HTML, JS en ligne, polices).
// La maquette est servie en local, compressée (brotli), comme en production.
// Usage : node scripts/mesures-maquette.mjs [--passages=3] [--sortie=reference/mesures]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { demarrerServeur } from "./lib/serveur-statique.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const PASSAGES = Number(args.passages ?? 3);
const sortie = resolve(racine, args.sortie ?? "reference/mesures");
const MAQUETTE = "hope-and-peace-farm-apercu-2.html";
mkdirSync(sortie, { recursive: true });

const serveur = await demarrerServeur(join(racine, "reference"), MAQUETTE);
const resultats = { url: serveur.url, date: new Date().toISOString(), lighthouse: {}, axe: {}, poids: {} };

// ---------- Poids ----------
const html = readFileSync(join(racine, "reference", MAQUETTE));
const texte = html.toString("utf8");
const jsEnLigne = [...texte.matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const polices = [...texte.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g)].map((m) => Buffer.from(m[1], "base64").length);
resultats.poids = {
  htmlBrut: html.length,
  htmlGzip: gzipSync(html, { level: 9 }).length,
  htmlBrotli: brotliCompressSync(html).length,
  jsEnLigneBrut: Buffer.byteLength(jsEnLigne),
  jsEnLigneBrotli: brotliCompressSync(Buffer.from(jsEnLigne)).length,
  policesWoff2: polices,
  policesBase64DansHtml: polices.reduce((s, n) => s + Math.ceil(n / 3) * 4, 0),
};

// ---------- Lighthouse ----------
const mediane = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
/** Premier nœud DOM cité dans le détail d'un audit (l'emplacement varie selon les versions). */
const noeud = (o, d = 0) => {
  if (!o || typeof o !== "object" || d > 8) return null;
  if (o.type === "node" && o.snippet) return o;
  for (const v of Object.values(o)) { const n = noeud(v, d + 1); if (n) return n; }
  return null;
};
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"] });
try {
  for (const [forme, config] of [["mobile", undefined], ["ordinateur", desktopConfig]]) {
    const passages = [];
    for (let i = 0; i < PASSAGES; i++) {
      const rapport = await lighthouse(serveur.url, { port: chrome.port, output: ["json", "html"], logLevel: "error", locale: "fr" }, config);
      const lhr = rapport.lhr;
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
        siMs: Math.round(num("speed-index")),
        lcpElement: noeud(lhr.audits["lcp-breakdown-insight"]?.details ?? lhr.audits["largest-contentful-paint-element"]?.details)?.snippet ?? null,
        mainThreadMs: Object.fromEntries((lhr.audits["mainthread-work-breakdown"]?.details?.items ?? []).map((x) => [x.group, Math.round(x.duration)])),
        octetsTransferes: num("total-byte-weight"),
        echecs: Object.values(lhr.audits)
          .filter((a) => a.score !== null && a.score < 1 && ["binary", "numeric"].includes(a.scoreDisplayMode) && lhr.categories && Object.values(lhr.categories).some((c) => c.id !== "performance" && c.auditRefs.some((r) => r.id === a.id && r.weight > 0)))
          .map((a) => `${a.id} : ${a.title}`),
      };
      passages.push(p);
      if (i === PASSAGES - 1) writeFileSync(join(sortie, `lighthouse-${forme}.html`), rapport.report[1]);
      console.log(`Lighthouse ${forme} #${i + 1} : perf ${p.performance} · a11y ${p.accessibilite} · BP ${p.bonnesPratiques} · SEO ${p.seo} · LCP ${p.lcpMs} ms · CLS ${p.cls} · TBT ${p.tbtMs} ms`);
    }
    const perfMed = mediane(passages.map((p) => p.performance));
    resultats.lighthouse[forme] = { medianePerformance: perfMed, passages, retenu: passages.find((p) => p.performance === perfMed) };
  }
} finally {
  await chrome.kill();
}

// ---------- axe-core ----------
const navigateur = await chromium.launch({ channel: "chrome" });
try {
  for (const [nom, width, height, mobile] of [["393x780", 393, 780, true], ["1280x800", 1280, 800, false]]) {
    const ctx = await navigateur.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(serveur.url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Formulaire initialisé (il l'est à l'approche) et apparitions terminées
    await page.locator(".request__card").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    resultats.axe[nom] = {
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, aide: v.help, noeuds: v.nodes.length, exemples: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })),
      incomplets: r.incomplete.map((v) => ({ id: v.id, noeuds: v.nodes.length })),
      reussis: r.passes.length,
    };
    console.log(`axe ${nom} : ${r.violations.length} violation(s), ${r.incomplete.length} à vérifier à la main, ${r.passes.length} règles réussies`);
    await ctx.close();
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

writeFileSync(join(sortie, "mesures.json"), JSON.stringify(resultats, null, 2) + "\n");
console.log("Poids :", JSON.stringify(resultats.poids));
console.log(`→ ${sortie}`);
