#!/usr/bin/env node
// Contrôle de parité entre la maquette et le site (brief §6 « Parité visuelle »).
// La maquette et le site sont ouverts dans le même navigateur (Chrome installé),
// avec les mêmes réglages et la même heure figée, puis comparés de trois façons :
//   1. DOM : arbre des éléments (balises et attributs, sauf `style`) et textes ;
//   2. texte affiché (innerText) de chaque région de la page ;
//   3. captures pixel par pixel (sharp) : accueil animé à 0, 14, 38, 66 et 97 %,
//      chaque section écran par écran, page entière (sans JS, mouvement réduit),
//      menu ouvert et formulaires (erreurs, étape 2, vue de succès).
// Formats : 360×640, 393×780, 768×1024, 1280×800 ; modes : js, sans-js, reduit.
//
// Les écarts voulus (corrections typographiques permises, mentions « [… à renseigner] »
// masquées) sont appliqués à la maquette avant comparaison : voir ECARTS_JUSTIFIES.
// Tout autre écart est listé dans le rapport.
//
// Usage : node scripts/parite-site.mjs --site=http://127.0.0.1:3100
//         [--seulement=393x780,1280x800] [--modes=js,reduit] [--sans-captures]
//         [--sortie=reference/parite]
// Le site doit tourner (npm run build puis npm run standalone, ou un déploiement).

import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { demarrerServeur } from "./lib/serveur-statique.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const SITE = args.site ?? "http://127.0.0.1:3100";
const sortie = resolve(racine, args.sortie ?? "reference/parite");
const avecCaptures = !("sans-captures" in args);
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
].filter((m) => !args.modes || args.modes.split(",").includes(m.nom));

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
const REGIONS = [".banner", ".header", "main > section", "footer", ".bar"];

// 11 octobre 2026, 10 h à Douala (UTC+1) : réservations des Fêtes, prix garanti.
const HEURE = "2026-10-11T09:00:00Z";

/** Écarts voulus, appliqués à la maquette avant comparaison (exécuté dans la page). */
const ECARTS_JUSTIFIES = [
  "Apostrophe typographique dans le message WhatsApp général (« J’aimerais ») : correction permise par le brief.",
  "Mentions légales : les lignes « [… à renseigner] » (responsable, e-mail, hébergeur) sont masquées tant que la valeur manque (brief §5 : une donnée absente cache son bloc).",
  "Sans JavaScript, le serveur pose la classe des Fêtes du jour (« fetes-garanti » ou « fetes-fin ») : le bandeau est juste sans JavaScript ; la maquette ne la pose qu’avec JavaScript (phase 3).",
];
function appliquerEcartsJustifies() {
  document.querySelectorAll('a[href*="J\'aimerais"]').forEach((a) => {
    a.setAttribute("href", a.getAttribute("href").replace("J'aimerais", "J%E2%80%99aimerais"));
  });
  document.querySelectorAll(".legal__body .todo").forEach((todo) => {
    const p = todo.closest("p");
    if (!p) return;
    if (/Coordonnées/.test(p.textContent)) p.innerHTML = p.innerHTML.replace(/ E-mail&nbsp;: <span class="todo">[^<]*<\/span>\./, "");
    else p.remove();
  });
}

/** Sérialise le DOM de <body> en lignes comparables (exécuté dans la page). */
function serialiserDom() {
  const IGNORER = new Set(["SCRIPT", "STYLE", "LINK", "META", "NEXT-ROUTE-ANNOUNCER", "TEMPLATE"]);
  const lignes = [];
  const espaces = (t) => t.replace(/[ \t\n\r\f]+/g, " ").trim();
  const attributs = (el) =>
    [...el.attributes]
      .filter((a) => a.name !== "style")
      .map((a) => `${a.name}="${a.value}"`)
      .sort()
      .join(" ");
  const visiter = (el, p) => {
    if (IGNORER.has(el.tagName)) return;
    const retrait = "  ".repeat(p);
    if (el.classList?.contains("sprite")) {
      lignes.push(`${retrait}<svg.sprite ${el.innerHTML.length} car.>`);
      return;
    }
    lignes.push(`${retrait}<${el.tagName.toLowerCase()}${el.attributes.length ? " " + attributs(el) : ""}>`);
    let texte = "";
    const vider = () => {
      const t = espaces(texte);
      if (t) lignes.push(`${retrait}  « ${t} »`);
      texte = "";
    };
    // <noscript> avec JavaScript actif : son contenu est du texte brut, analysé ici.
    const enfants =
      el.tagName === "NOSCRIPT"
        ? (() => {
            const t = document.createElement("template");
            t.innerHTML = el.textContent;
            return t.content.childNodes;
          })()
        : el.childNodes;
    for (const n of enfants) {
      if (n.nodeType === 3) texte += n.data;
      else if (n.nodeType === 1) {
        vider();
        visiter(n, p + 1);
      }
    }
    vider();
  };
  for (const n of document.body.children) {
    // Next.js : <div hidden> vide en tête de <body> (métadonnées en flux).
    if (n.tagName === "DIV" && n.hidden && !n.children.length && !n.textContent.trim()) continue;
    visiter(n, 0);
  }
  const classesHtml = document.documentElement.className
    .split(/\s+/)
    .filter((c) => c && !/_variable$/.test(c))
    .sort()
    .join(" ");
  const html = [...document.documentElement.attributes]
    .filter((a) => !["class", "style"].includes(a.name))
    .map((a) => `${a.name}="${a.value}"`)
    .sort()
    .join(" ");
  return { lignes, html: `<html ${html}> classes: ${classesHtml}` };
}

/**
 * Géométrie de chaque élément de <body>, dans l’ordre du document (exécuté dans la page) :
 * position et taille au 1/100 de pixel. Le DOM étant identique, les deux listes se
 * correspondent élément par élément ; un écart ici est un écart de mise en page.
 */
function geometrieElements() {
  const IGNORER = new Set(["SCRIPT", "STYLE", "LINK", "META", "NEXT-ROUTE-ANNOUNCER", "TEMPLATE", "NOSCRIPT"]);
  const sortie = [];
  const r2 = (v) => Math.round(v * 100) / 100;
  const visiter = (el, chemin) => {
    if (IGNORER.has(el.tagName)) return;
    if (el.classList?.contains("sprite")) return;
    const r = el.getBoundingClientRect();
    const nom = `${chemin}>${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.classList?.[0] ? "." + el.classList[0] : ""}`;
    sortie.push([nom, r2(r.left), r2(r.top + scrollY), r2(r.width), r2(r.height)]);
    [...el.children].forEach((e, i) => visiter(e, `${nom}[${i}]`.slice(-120)));
  };
  [...document.body.children]
    .filter((n) => !(n.tagName === "DIV" && n.hidden && !n.children.length))
    .forEach((n, i) => visiter(n, String(i)));
  return sortie;
}

/** Texte affiché de chaque région (exécuté dans la page). */
function textesRegions(regions) {
  const sortie = {};
  for (const sel of regions) {
    document.querySelectorAll(sel).forEach((el, i) => {
      sortie[`${sel}[${i}]${el.id ? "#" + el.id : ""}`] = el.innerText;
    });
  }
  return sortie;
}

/** Plus longue sous-suite commune : différences ligne à ligne (−maquette, +site). */
function differences(a, b, contexte = 2) {
  const n = a.length;
  const m = b.length;
  const table = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i * (m + 1) + j] = a[i] === b[j] ? table[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(table[(i + 1) * (m + 1) + j], table[i * (m + 1) + j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push([" ", a[i++], j++]);
    else if (j < m && (i === n || table[i * (m + 1) + j + 1] >= table[(i + 1) * (m + 1) + j])) ops.push(["+", b[j++]]);
    else ops.push(["-", a[i++]]);
  }
  const garder = new Set();
  ops.forEach((o, k) => {
    if (o[0] !== " ") for (let d = -contexte; d <= contexte; d++) garder.add(k + d);
  });
  const blocs = [];
  let precedent = -2;
  ops.forEach((o, k) => {
    if (!garder.has(k)) return;
    if (k !== precedent + 1) blocs.push("···");
    blocs.push(`${o[0]} ${o[1]}`);
    precedent = k;
  });
  return { nombre: ops.filter((o) => o[0] !== " ").length, blocs };
}

// ---------------------------------------------------------------------------
// Captures et comparaison d’images

async function deuxImages(page, js) {
  if (!js) return page.waitForTimeout(100);
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok()))));
}
async function scrollerVers(page, y, js) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await deuxImages(page, js);
  await page.waitForTimeout(350);
  await deuxImages(page, js);
}
async function toutReveler(page) {
  const { hauteur, vh } = await page.evaluate(() => ({ hauteur: document.documentElement.scrollHeight, vh: innerHeight }));
  for (let y = 0; y < hauteur; y += Math.round(vh * 0.5)) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
}
async function geometrie(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const hero = document.querySelector(".hero");
    const stage = document.querySelector(".hero__stage");
    const header = document.querySelector(".header");
    return {
      scrolly: root.classList.contains("scrolly"),
      hauteurPage: root.scrollHeight,
      enTete: header.offsetHeight,
      heroHautDoc: hero.getBoundingClientRect().top + scrollY,
      course: Math.max(1, hero.offsetHeight - stage.offsetHeight),
      debordement: root.scrollWidth - root.clientWidth,
    };
  });
}

async function comparerImages(bufA, bufB, chemin) {
  const [a, b] = await Promise.all([bufA, bufB].map((buf) => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const largeur = Math.min(a.info.width, b.info.width);
  const hauteur = Math.min(a.info.height, b.info.height);
  const ecart = Buffer.alloc(largeur * hauteur * 4);
  let differents = 0;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const ia = (y * a.info.width + x) * 4;
      const ib = (y * b.info.width + x) * 4;
      const io = (y * largeur + x) * 4;
      const d = Math.max(Math.abs(a.data[ia] - b.data[ib]), Math.abs(a.data[ia + 1] - b.data[ib + 1]), Math.abs(a.data[ia + 2] - b.data[ib + 2]));
      if (d > 24) {
        differents++;
        ecart.set([255, 0, 0, 255], io);
      } else {
        const g = Math.round((a.data[ia] + a.data[ia + 1] + a.data[ia + 2]) / 3);
        ecart.set([g, g, g, 70], io);
      }
    }
  }
  const memesDimensions = a.info.width === b.info.width && a.info.height === b.info.height;
  const ratio = differents / (largeur * hauteur);
  if (differents > 0 || !memesDimensions) {
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(`${chemin}-maquette.png`, bufA);
    writeFileSync(`${chemin}-site.png`, bufB);
    await sharp(ecart, { raw: { width: largeur, height: hauteur, channels: 4 } }).png().toFile(`${chemin}-ecart.png`);
  }
  return {
    differents,
    ratio: Number(ratio.toFixed(6)),
    dimensions: memesDimensions ? `${a.info.width}×${a.info.height}` : `${a.info.width}×${a.info.height} / ${b.info.width}×${b.info.height}`,
  };
}

// ---------------------------------------------------------------------------

const serveur = await demarrerServeur(join(racine, "reference"), MAQUETTE);
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const rapport = { site: SITE, navigateur: `Chrome ${navigateur.version()}`, heureFigee: HEURE, ecartsJustifies: ECARTS_JUSTIFIES, formats: {} };
if (avecCaptures) rmSync(sortie, { recursive: true, force: true });
const debut = Date.now();

/** Classes des Fêtes que le serveur du site pose sur <html>. */
async function classesFetesDuServeur() {
  const html = await (await fetch(SITE)).text();
  return (/<html[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/).filter((c) => c.startsWith("fetes-"));
}

async function ouvrir(url, format, mode, estMaquette, classesAjoutees = []) {
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
    // Site : un visiteur distinct par contexte (limite de 10 envois par heure et par adresse).
    ...(estMaquette ? {} : { extraHTTPHeaders: { "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(256)}` } }),
  });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") erreurs.push(`${m.type()} : ${m.text()}`);
  });
  if (mode.js) await page.clock.setFixedTime(new Date(HEURE));
  if (classesAjoutees.length) {
    await page.route(url, async (route) => {
      const reponse = await route.fetch();
      const corps = (await reponse.text()).replace('class="no-js"', `class="no-js ${classesAjoutees.join(" ")}"`);
      await route.fulfill({ response: reponse, body: corps });
    });
  }
  await page.goto(url, { waitUntil: "load" });
  if (mode.js) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1700); // assemblage du logo : 1,45 s
  } else {
    await page.waitForTimeout(300);
  }
  // page.evaluate fonctionne aussi quand le JavaScript de la page est désactivé.
  if (estMaquette) await page.evaluate(appliquerEcartsJustifies);
  return { contexte, page, erreurs };
}

try {
  for (const format of FORMATS) {
    rapport.formats[format.nom] = {};
    for (const mode of MODES) {
      // Écart voulu : sans JavaScript, la classe des Fêtes du site vient du serveur ; elle est
      // injectée dans le HTML de la maquette avant sa lecture (pas après le premier affichage).
      const classesFetes = mode.js ? [] : await classesFetesDuServeur();
      const m = await ouvrir(serveur.url, format, mode, true, classesFetes);
      const s = await ouvrir(SITE, format, mode, false);
      const info = { erreursConsole: { maquette: m.erreurs, site: s.erreurs }, classesFetesServeur: classesFetes };

      // 0. Captures de l’accueil, juste après le chargement, comme scripts/captures-maquette.mjs :
      // le défilement complet qui précède les contrôles suivants laisserait des calques composités
      // rastérisés à des positions qui dépendent du minutage (écarts d’anticrénelage seulement).
      const captures = [];
      const geoM = await geometrie(m.page);
      const geoS = await geometrie(s.page);
      info.geometrie = { maquette: geoM, site: geoS };
      const comparer = async (nom, options = {}) => {
        const [a, b] = [
          await m.page.screenshot({ animations: "disabled", caret: "hide", ...options }),
          await s.page.screenshot({ animations: "disabled", caret: "hide", ...options }),
        ];
        const r = await comparerImages(a, b, join(sortie, format.nom, mode.nom, nom));
        captures.push({ nom, ...r });
      };
      const lesDeux = async (f) => {
        await f(m.page, geoM);
        await f(s.page, geoS);
      };
      if (avecCaptures) {
        if (mode.nom === "js" && geoM.scrolly && geoS.scrolly) {
          for (const p of COURSE) {
            await lesDeux((page, g) => scrollerVers(page, p === 0 ? 0 : Math.round(g.heroHautDoc - g.enTete + p * g.course), true));
            await comparer(`00-accueil-${String(Math.round(p * 100)).padStart(2, "0")}`);
          }
        } else {
          await lesDeux((page) => scrollerVers(page, 0, mode.js));
          await comparer("00-accueil");
        }
      }

      // 1 et 2. DOM et texte affiché, après apparition de tout (mode js) ou d’emblée.
      if (mode.js) {
        await toutReveler(m.page);
        await toutReveler(s.page);
        await scrollerVers(m.page, 0, true);
        await scrollerVers(s.page, 0, true);
      }
      const domM = await m.page.evaluate(serialiserDom);
      const domS = await s.page.evaluate(serialiserDom);
      const diffDom = differences(domM.lignes, domS.lignes);
      const textesM = await m.page.evaluate(textesRegions, REGIONS);
      const textesS = await s.page.evaluate(textesRegions, REGIONS);
      const diffTextes = {};
      for (const cle of new Set([...Object.keys(textesM), ...Object.keys(textesS)])) {
        if (textesM[cle] !== textesS[cle]) {
          diffTextes[cle] = differences((textesM[cle] ?? "").split("\n"), (textesS[cle] ?? "").split("\n"), 1).blocs;
        }
      }
      info.dom = { lignes: domS.lignes.length, ecarts: diffDom.nombre, html: domM.html === domS.html ? "identique" : { maquette: domM.html, site: domS.html } };
      // Géométrie : comparée seulement si les deux DOM se correspondent.
      const geoElM = await m.page.evaluate(geometrieElements);
      const geoElS = await s.page.evaluate(geometrieElements);
      if (geoElM.length === geoElS.length) {
        const ecartsGeo = [];
        geoElM.forEach((a, k) => {
          const b = geoElS[k];
          const ecartMax = Math.max(...[1, 2, 3, 4].map((x) => Math.abs(a[x] - b[x])));
          if (ecartMax > 0.01) ecartsGeo.push({ element: a[0], maquette: a.slice(1), site: b.slice(1), ecartMax: Number(ecartMax.toFixed(2)) });
        });
        info.geometrieElements = { elements: geoElM.length, ecarts: ecartsGeo.length, premiers: ecartsGeo.slice(0, 30) };
      } else {
        info.geometrieElements = { elements: `${geoElM.length} / ${geoElS.length}`, ecarts: "non comparable" };
      }
      if (diffDom.nombre) info.dom.differences = diffDom.blocs.slice(0, 400);
      info.textes = { regions: Object.keys(textesS).length, ecarts: Object.keys(diffTextes).length, differences: diffTextes };

      // 3. Captures des sections et des états d’interface (l’accueil est déjà capturé).
      if (avecCaptures) {
        for (const [nom, selecteur] of SECTIONS) {
          const boites = [];
          for (const page of [m.page, s.page]) {
            boites.push(
              await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                const r = el.getBoundingClientRect();
                return { haut: r.top + scrollY, bas: r.bottom + scrollY };
              }, selecteur),
            );
          }
          const pas = format.height - geoM.enTete;
          for (let i = 1; i <= 12; i++) {
            const decalage = (i - 1) * pas;
            await scrollerVers(m.page, Math.max(0, boites[0].haut - geoM.enTete) + decalage, mode.js);
            await scrollerVers(s.page, Math.max(0, boites[1].haut - geoS.enTete) + decalage, mode.js);
            await comparer(`${nom}${i > 1 ? `-${i}` : ""}`);
            if (Math.max(0, boites[0].haut - geoM.enTete) + decalage + format.height >= boites[0].bas - 1) break;
          }
        }

        if (mode.nom !== "js") {
          await lesDeux((page) => scrollerVers(page, 0, mode.js));
          await comparer("page-entiere", { fullPage: true });
        } else {
          // États d’interface : menu, formulaire cérémonie, onglets.
          for (const page of [m.page, s.page]) await scrollerVers(page, 0, true);
          if (format.width < 1120) {
            await lesDeux(async (page) => {
              await page.click(".menu__toggle");
              await page.waitForTimeout(400);
            });
            await comparer("etat-menu-ouvert");
            await lesDeux(async (page) => {
              await page.keyboard.press("Escape");
              await page.waitForTimeout(300);
            });
          }
          const etapes = [
            ["etat-form-ceremonie-etape1", async () => {}],
            ["etat-form-ceremonie-erreurs", async (p) => p.locator('form[data-form="ceremonie"] [data-next]').click()],
            [
              "etat-form-ceremonie-etape2",
              async (p) => {
                const f = p.locator('form[data-form="ceremonie"]');
                await f.locator('label.chip:has(input[value="funerailles"])').click();
                await f.locator('input[name="date"]').fill("2026-12-19");
                await f.locator('input[name="lieu"]').fill("Bazou, chefferie, près du marché");
                await f.locator('label.chip:has(input[value="100 à 200"])').click();
                await f.locator("[data-next]").click();
              },
            ],
            [
              "etat-form-ceremonie-succes",
              async (p) => {
                const f = p.locator('form[data-form="ceremonie"]');
                await f.locator('input[name="nom"]').fill("Exemple Test");
                await f.locator('input[name="residence"]').fill("Douala");
                // Phase 4, site seulement : numéro WhatsApp et accord, délai de l’anti-spam,
                // puis attente de la réponse du serveur.
                if (await f.locator('input[name="whatsapp"]').count()) {
                  await f.locator('input[name="whatsapp"]').fill(`6${String(randomInt(1e8)).padStart(8, "0")}`);
                  await f.locator('input[name="consentement"]').check();
                  await p.waitForTimeout(3200);
                }
                await f.locator('button[type="submit"]').click();
                await f.locator(".done").waitFor();
                await p.waitForTimeout(300);
                await f.locator(".done").scrollIntoViewIfNeeded();
              },
            ],
          ];
          await lesDeux(async (page) => {
            await page.locator(".request__card").scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
          });
          for (const [nom, action] of etapes) {
            await lesDeux(async (page) => {
              await action(page);
              await page.waitForTimeout(400);
            });
            // Même position de défilement des deux côtés : celle de la maquette.
            const y = await m.page.evaluate(() => scrollY);
            await scrollerVers(s.page, y, true);
            await scrollerVers(m.page, y, true);
            await comparer(nom);
          }
          info.messageCeremonie = {
            maquette: await m.page.locator('form[data-form="ceremonie"] [data-done-wa]').getAttribute("href"),
            site: await s.page.locator('form[data-form="ceremonie"] [data-done-wa]').getAttribute("href"),
          };
          // Phase 4 : le site ajoute « (Réf. HP-…) » au message de la maquette (brief §3).
          const sansReference = (lien) => lien?.replace(/%20\(R%C3%A9f\.%20HP-\d{6}-[2-9A-HJ-NP-Z]{6}\)$/, "");
          info.messageCeremonie.reference = /R%C3%A9f\.%20HP-/.test(info.messageCeremonie.site ?? "");
          info.messageCeremonie.identique = info.messageCeremonie.maquette === sansReference(info.messageCeremonie.site);
        }
        info.captures = {
          total: captures.length,
          identiques: captures.filter((c) => c.differents === 0 && !c.dimensions.includes("/")).length,
          differentes: captures.filter((c) => c.differents > 0 || c.dimensions.includes("/")),
        };
      }

      await m.contexte.close();
      await s.contexte.close();
      rapport.formats[format.nom][mode.nom] = info;
      const resumeCaptures = info.captures ? ` captures ${info.captures.identiques}/${info.captures.total} identiques` : "";
      console.log(
        `${format.nom} ${mode.nom.padEnd(7)} DOM ${info.dom.ecarts} écart(s) · géométrie ${info.geometrieElements.ecarts} écart(s) sur ${info.geometrieElements.elements} éléments · textes ${info.textes.ecarts} région(s) différente(s)${resumeCaptures} · erreurs console ${s.erreurs.length}`,
      );
    }
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

rapport.duree = `${Math.round((Date.now() - debut) / 1000)} s`;
mkdirSync(sortie, { recursive: true });
writeFileSync(join(sortie, "rapport.json"), JSON.stringify(rapport, null, 2) + "\n");
console.log(`Rapport : ${join(sortie, "rapport.json")} (${rapport.duree})`);
