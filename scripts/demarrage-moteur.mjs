#!/usr/bin/env node
// Délai entre le premier affichage et le démarrage du moteur (landing épinglée,
// apparitions, barre fixe…), maquette contre site, en conditions mobiles simulées :
// processeur ralenti 4 fois, réseau « 4G lente » (Lighthouse : 150 ms, 1,6 Mbit/s)
// et « 3G » (300 ms, 750 kbit/s). Le démarrage est repéré par la classe `reveal-on`,
// posée sur <html> au lancement du moteur dans les deux pages.
// Usage : node scripts/demarrage-moteur.mjs --site=http://127.0.0.1:3100 [--passages=3]

import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { demarrerServeur } from "./lib/serveur-statique.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const SITE = args.site ?? "http://127.0.0.1:3100";
const PASSAGES = Number(args.passages ?? 3);
const RESEAUX = [
  { nom: "4G lente", latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  { nom: "3G", latency: 300, downloadThroughput: (750 * 1024) / 8, uploadThroughput: (250 * 1024) / 8 },
];

const serveur = await demarrerServeur(join(racine, "reference"), "hope-and-peace-farm-apercu-2.html");
const navigateur = await chromium.launch({ channel: "chrome", headless: true });

async function mesurer(url, reseau) {
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();
  await page.addInitScript(() => {
    const t = (window.__temps = {});
    // <html> n’existe pas encore quand ce script s’exécute : on observe tout le document.
    new MutationObserver(() => {
      if (!t.moteur && document.documentElement?.classList.contains("reveal-on")) t.moteur = performance.now();
    }).observe(document, { attributes: true, attributeFilter: ["class"], subtree: true, childList: true });
  });
  const cdp = await contexte.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, ...reseau });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForFunction(() => window.__temps.moteur, null, { timeout: 60_000 });
  const r = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
    domContentLoaded: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
    load: performance.getEntriesByType("navigation")[0].loadEventEnd,
    moteur: window.__temps.moteur,
  }));
  await contexte.close();
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? null : Math.round(v)]));
}

const mediane = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
try {
  for (const reseau of RESEAUX) {
    for (const [nom, url] of [["maquette", serveur.url], ["site", SITE]]) {
      const mesures = [];
      for (let i = 0; i < PASSAGES; i++) mesures.push(await mesurer(url, reseau));
      const m = (k) => mediane(mesures.map((x) => x[k]));
      console.log(
        `${reseau.nom.padEnd(8)} ${nom.padEnd(8)} FCP ${m("fcp")} ms · moteur démarré ${m("moteur")} ms (FCP + ${m("moteur") - m("fcp")} ms) · DOMContentLoaded ${m("domContentLoaded")} ms · load ${m("load")} ms`,
      );
    }
  }
} finally {
  await navigateur.close();
  await serveur.close();
}
