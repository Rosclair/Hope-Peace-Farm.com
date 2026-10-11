#!/usr/bin/env node
// Captures de référence de la maquette (Playwright, Chrome installé).
//
// Pour chaque format d'écran (360×640, 393×780, 768×1024, 1280×800) et chaque mode :
//   - js      : JavaScript actif, animations acceptées ;
//   - sans-js : JavaScript désactivé ;
//   - reduit  : JavaScript actif, « réduire les animations ».
// on capture :
//   - l'accueil animé à 0, 14, 38, 66 et 97 % de sa course (mode js, landing épinglée) ;
//   - chaque section, en haut d'écran sous l'en-tête, puis écran par écran jusqu'à sa fin ;
//   - la page entière (modes sans-js et reduit, où rien n'est épinglé) ;
//   - quelques états d'interface (menu, formulaires, vue de succès) en mode js ;
//   - les trois états des Fêtes (avant la date limite, après, après la fin).
// L'heure est figée (heure de Douala) pour que le bandeau des Fêtes soit stable.
// Usage : node scripts/captures-maquette.mjs [--seulement=393x780] [--sortie=reference/captures]

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { demarrerServeur } from "./lib/serveur-statique.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const sortie = resolve(racine, args.sortie ?? "reference/captures");
const MAQUETTE = "hope-and-peace-farm-apercu-2.html";

const FORMATS = [
  { nom: "360x640", width: 360, height: 640, mobile: true },
  { nom: "393x780", width: 393, height: 780, mobile: true },
  { nom: "768x1024", width: 768, height: 1024, mobile: true },
  { nom: "1280x800", width: 1280, height: 800, mobile: false },
].filter((f) => !args.seulement || args.seulement.split(",").includes(f.nom));

const MODES = [
  { nom: "js", js: true, reducedMotion: "no-preference" },
  { nom: "sans-js", js: false, reducedMotion: "no-preference" },
  { nom: "reduit", js: true, reducedMotion: "reduce" },
];

const COURSE = [0, 0.14, 0.38, 0.66, 0.97];

const SECTIONS = [
  ["01-garanties", "section.assurance"],
  ["02-choix", 'section[aria-labelledby="titre-choix"]'],
  ["03-deroule", 'section[aria-labelledby="titre-marche"]'],
  ["04-ceremonies", "#ceremonies"],
  ["05-poulets", "#poulets"],
  ["06-professionnels", "#professionnels"],
  ["07-livraison", "#livraison"],
  ["08-la-ferme", "#la-ferme"],
  ["09-questions", "#questions"],
  ["10-demande", "#demande"],
  ["11-pied-de-page", "footer.footer"],
];

// 11 octobre 2026, 10 h à Douala (UTC+1) : réservations des Fêtes, prix garanti.
const HEURE_REFERENCE = "2026-10-11T09:00:00Z";
const FETES = [
  ["garanti", "2026-10-15T09:00:00Z"],
  ["apres-date-limite", "2026-11-15T09:00:00Z"],
  ["fin", "2026-12-21T09:00:00Z"],
];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const manifeste = { maquetteSha256: "", navigateur: "", heureFigee: HEURE_REFERENCE, formats: {}, captures: [] };

const pagesSansJs = new WeakSet();

async function deuxImages(page) {
  // Sans JavaScript, requestAnimationFrame ne se déclenche pas dans la page : simple attente.
  if (pagesSansJs.has(page)) return page.waitForTimeout(100);
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok()))));
}

async function capture(page, chemin, options = {}) {
  const complet = join(sortie, chemin);
  mkdirSync(dirname(complet), { recursive: true });
  const buf = await page.screenshot({ path: complet, animations: "disabled", caret: "hide", ...options });
  manifeste.captures.push({ fichier: chemin.replaceAll("\\", "/"), octets: buf.length, sha256: sha256(buf) });
}

async function ouvrir(navigateur, format, mode, heure = HEURE_REFERENCE) {
  const contexte = await navigateur.newContext({
    viewport: { width: format.width, height: format.height },
    deviceScaleFactor: 1,
    isMobile: format.mobile,
    hasTouch: format.mobile,
    javaScriptEnabled: mode.js,
    reducedMotion: mode.reducedMotion,
    locale: "fr-CM",
    timezoneId: "Africa/Douala",
    colorScheme: "light",
  });
  const page = await contexte.newPage();
  if (!mode.js) pagesSansJs.add(page);
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  if (mode.js) await page.clock.setFixedTime(new Date(heure));
  await page.goto(serveur.url, { waitUntil: "load" });
  if (mode.js) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1700); // assemblage du logo : 1,45 s
  } else {
    await page.waitForTimeout(300);
  }
  return { contexte, page, erreurs };
}

/** Fait défiler toute la page pour déclencher les apparitions, puis remonte. */
async function toutReveler(page) {
  const { hauteur, vh } = await page.evaluate(() => ({ hauteur: document.documentElement.scrollHeight, vh: innerHeight }));
  for (let y = 0; y < hauteur; y += Math.round(vh * 0.5)) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
}

async function scrollerVers(page, y) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await deuxImages(page);
  await page.waitForTimeout(350); // observateurs (barre fixe, apparitions)
  await deuxImages(page);
}

async function geometrie(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const hero = document.querySelector(".hero");
    const stage = document.querySelector(".hero__stage");
    const header = document.querySelector(".header");
    return {
      classes: root.className,
      scrolly: root.classList.contains("scrolly"),
      hauteurPage: root.scrollHeight,
      enTete: header.offsetHeight,
      heroHautDoc: hero.getBoundingClientRect().top + scrollY,
      course: Math.max(1, hero.offsetHeight - stage.offsetHeight),
      debordementHorizontal: root.scrollWidth - root.clientWidth,
    };
  });
}

async function sections(page, dossier, enTete) {
  for (const [nom, selecteur] of SECTIONS) {
    const boite = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { haut: r.top + scrollY, bas: r.bottom + scrollY };
    }, selecteur);
    if (!boite) throw new Error(`Section introuvable : ${selecteur}`);
    const vh = await page.evaluate(() => innerHeight);
    const pas = vh - enTete;
    let y = Math.max(0, boite.haut - enTete);
    for (let i = 1; ; i++) {
      await scrollerVers(page, y);
      await capture(page, join(dossier, `${nom}${i > 1 ? `-${i}` : ""}.png`));
      if (y + vh >= boite.bas - 1 || i >= 12) break;
      y += pas;
    }
  }
}

async function etats(page, dossier, format) {
  // Menu mobile ouvert (sous 70em)
  if (format.width < 1120) {
    await scrollerVers(page, 0);
    await page.click(".menu__toggle");
    await page.waitForTimeout(400);
    await capture(page, join(dossier, "menu-ouvert.png"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  // Formulaire cérémonie : étape 1 vide, erreurs, étape 2, vue de succès
  const carte = page.locator(".request__card");
  await carte.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const ceremonie = page.locator('form[data-form="ceremonie"]');
  await capture(page, join(dossier, "form-ceremonie-etape1.png"), { clip: undefined });
  await ceremonie.locator("[data-next]").click();
  await page.waitForTimeout(300);
  await capture(page, join(dossier, "form-ceremonie-erreurs.png"));
  await ceremonie.locator('label.chip:has(input[value="funerailles"])').click();
  await ceremonie.locator('input[name="date"]').fill("2026-12-19");
  await ceremonie.locator('input[name="lieu"]').fill("Bazou, chefferie, près du marché");
  await ceremonie.locator('label.chip:has(input[value="100 à 200"])').click();
  await ceremonie.locator("[data-next]").click();
  await page.waitForTimeout(300);
  await capture(page, join(dossier, "form-ceremonie-etape2.png"));
  await ceremonie.locator('input[name="nom"]').fill("Exemple Test");
  await ceremonie.locator('input[name="residence"]').fill("Douala");
  await ceremonie.locator('button[type="submit"]').click();
  await page.waitForTimeout(400);
  await ceremonie.locator(".done").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await capture(page, join(dossier, "form-ceremonie-succes.png"));
  const message = await ceremonie.locator("[data-done-message]").textContent();
  const lien = await ceremonie.locator("[data-done-wa]").getAttribute("href");
  await ceremonie.locator("[data-edit]").click();
  // Onglets Poulets et Pro
  for (const type of ["poulets", "pro"]) {
    await page.locator(`label.tab:has(input[value="${type}"])`).click();
    await page.waitForTimeout(200);
    await carte.scrollIntoViewIfNeeded();
    await capture(page, join(dossier, `form-${type}-etape1.png`));
  }
  return { messageCeremonie: message, lienCeremonie: lien };
}

// ---------------------------------------------------------------------------
const serveur = await demarrerServeur(join(racine, "reference"), MAQUETTE);
manifeste.maquetteSha256 = sha256(readFileSync(join(racine, "reference", MAQUETTE)));
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
manifeste.navigateur = `Chrome ${navigateur.version()}`;
rmSync(sortie, { recursive: true, force: true });
const debut = Date.now();

try {
  for (const format of FORMATS) {
    manifeste.formats[format.nom] = {};
    for (const mode of MODES) {
      const dossier = join(format.nom, mode.nom);
      const { contexte, page, erreurs } = await ouvrir(navigateur, format, mode);
      const geo = await geometrie(page);
      const info = { ...geo, erreursConsole: erreurs };

      if (mode.nom === "js" && geo.scrolly) {
        info.positionsAccueil = [];
        for (const p of COURSE) {
          const y = p === 0 ? 0 : Math.round(geo.heroHautDoc - geo.enTete + p * geo.course);
          await scrollerVers(page, y);
          const reel = await page.evaluate(({ enTete, course }) => {
            const top = document.querySelector(".hero").getBoundingClientRect().top;
            return Math.min(1, Math.max(0, (enTete - top) / course));
          }, geo);
          info.positionsAccueil.push({ cible: p, scrollY: y, progression: Number(reel.toFixed(4)) });
          await capture(page, join(dossier, `00-accueil-${String(Math.round(p * 100)).padStart(2, "0")}.png`));
        }
      } else {
        await scrollerVers(page, 0);
        await capture(page, join(dossier, "00-accueil.png"));
      }

      if (mode.nom === "js") await toutReveler(page);
      await sections(page, dossier, geo.enTete);

      if (mode.nom !== "js") {
        await scrollerVers(page, 0);
        await capture(page, join(dossier, "page-entiere.png"), { fullPage: true });
      } else {
        Object.assign(info, await etats(page, join(dossier, "etats"), format));
      }
      info.erreursConsole = erreurs;
      manifeste.formats[format.nom][mode.nom] = info;
      await contexte.close();
      console.log(`${format.nom} ${mode.nom.padEnd(7)} scrolly=${geo.scrolly} hauteur=${geo.hauteurPage}px débordement=${geo.debordementHorizontal}px erreurs=${erreurs.length}`);
    }
  }

  // États des Fêtes, au format mobile de référence
  const mobile = FORMATS.find((f) => f.nom === "393x780") ?? FORMATS[0];
  manifeste.fetes = {};
  for (const [nom, heure] of FETES) {
    const { contexte, page } = await ouvrir(navigateur, mobile, MODES[2], heure); // réduit : état final immédiat
    manifeste.fetes[nom] = await page.evaluate(() => document.documentElement.className);
    await capture(page, join("fetes", `${nom}-haut.png`));
    const y = await page.evaluate(() => document.querySelector("#fetes").getBoundingClientRect().top + scrollY - document.querySelector(".header").offsetHeight);
    await scrollerVers(page, y);
    await capture(page, join("fetes", `${nom}-bloc.png`));
    manifeste.fetes[`${nom}-lien`] = await page.locator("#fetes-reserver").getAttribute("href");
    await contexte.close();
  }

  // Débordement horizontal de 320 à 1 920 px (exigence : aucun)
  manifeste.debordement = {};
  for (const width of [320, 360, 393, 412, 768, 1024, 1280, 1440, 1920]) {
    const ctx = await navigateur.newContext({ viewport: { width, height: 800 }, isMobile: width < 1024, hasTouch: width < 1024 });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(HEURE_REFERENCE));
    await page.goto(serveur.url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    manifeste.debordement[width] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await ctx.close();
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

manifeste.duree = `${Math.round((Date.now() - debut) / 1000)} s`;
manifeste.total = manifeste.captures.length;
manifeste.octets = manifeste.captures.reduce((s, c) => s + c.octets, 0);
writeFileSync(join(sortie, "manifeste.json"), JSON.stringify(manifeste, null, 2) + "\n");
console.log(`${manifeste.total} captures, ${(manifeste.octets / 1048576).toFixed(1)} Mo, ${manifeste.duree} → ${sortie}`);
console.log("Débordement horizontal :", JSON.stringify(manifeste.debordement));
