#!/usr/bin/env node
// Extrait de la maquette (fichier HTML unique) ses ressources embarquées,
// sans jamais afficher les données base64 :
//   - polices WOFF2 (décodées depuis les data: URI des @font-face) ;
//   - logo SVG complet (dégradés + calques #lg-*) et sprite d'icônes ;
//   - favicon SVG ;
//   - CSS (avec les polices pointant vers les fichiers extraits) ;
//   - script de tête, script principal et JSON-LD ;
//   - structure.html : la page lisible, données volumineuses remplacées par un renvoi.
// Usage : node scripts/extraire-maquette.mjs [maquette.html] [dossier-sortie]

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? join(racine, "reference/hope-and-peace-farm-apercu-2.html"));
const sortie = resolve(process.argv[3] ?? join(racine, "reference/extrait"));

const html = readFileSync(source, "utf8");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const fichiers = [];

function ecrire(chemin, contenu) {
  const complet = join(sortie, chemin);
  mkdirSync(dirname(complet), { recursive: true });
  writeFileSync(complet, contenu);
  const buf = typeof contenu === "string" ? Buffer.from(contenu, "utf8") : contenu;
  fichiers.push({ fichier: chemin.replaceAll("\\", "/"), octets: buf.length, sha256: sha256(buf) });
}

function unique(regex, quoi) {
  const m = [...html.matchAll(regex)];
  if (m.length !== 1) throw new Error(`${quoi} : ${m.length} correspondance(s) au lieu d'une`);
  return m[0];
}

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- 1. CSS et polices ----------
const style = unique(/<style>([\s\S]*?)<\/style>/g, "Bloc <style>");
let css = style[1];
const polices = [];
css = css.replace(/@font-face\s*\{[^}]*\}/g, (bloc) => {
  const data = bloc.match(/url\("data:font\/woff2;base64,([A-Za-z0-9+/=]+)"\)/);
  if (!data) return bloc; // polices de repli (local())
  const famille = bloc.match(/font-family:\s*"([^"]+)"/)?.[1];
  const graisse = bloc.match(/font-weight:\s*(\d+)/)?.[1];
  const styleP = bloc.match(/font-style:\s*(\w+)/)?.[1] ?? "normal";
  if (!famille || !graisse) throw new Error("@font-face sans famille ou graisse");
  const binaire = Buffer.from(data[1], "base64");
  if (binaire.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error(`${famille} ${graisse} : signature WOFF2 absente`);
  const nom = `polices/${slug(famille)}-${graisse}${styleP === "normal" ? "" : "-" + styleP}.woff2`;
  ecrire(nom, binaire);
  polices.push({ famille, graisse: Number(graisse), style: styleP, fichier: nom, octets: binaire.length });
  return bloc.replace(data[0], `url("${nom}")`);
});
if (polices.length !== 3) throw new Error(`3 polices attendues, ${polices.length} trouvées`);
if (/base64/.test(css)) throw new Error("Il reste du base64 dans le CSS");
ecrire("styles.css", css.replace(/^\n/, ""));

// CSS de l'application (app/maquette.css) : celui de la maquette, à deux changements près.
// Les trois polices sont déclarées par next/font/local (app/polices.ts), qui expose leurs
// familles dans --police-titre et --police-texte (avec les mêmes polices de repli).
function remplacerUneFois(texte, avant, apres) {
  const n = texte.split(avant).length - 1;
  if (n !== 1) throw new Error(`CSS de l'application : « ${String(avant).slice(0, 60)} » trouvé ${n} fois`);
  return texte.replace(avant, apres);
}
let cssApp = css.replace(/^\n/, "");
const policesCss = cssApp.match(/@font-face\s*\{[^}]*url\("polices\/[^}]*\}\n/g) ?? [];
if (policesCss.length !== 3) throw new Error(`CSS de l'application : ${policesCss.length} @font-face de polices au lieu de 3`);
policesCss.forEach((bloc, i) => {
  cssApp = remplacerUneFois(cssApp, bloc, i === 0 ? "/* Polices : déclarées par next/font/local (app/polices.ts), mêmes fichiers WOFF2. */\n" : "");
});
cssApp = remplacerUneFois(cssApp, '--font-display: "Bricolage Grotesque", "Display Fallback", Arial, sans-serif;', "--font-display: var(--police-titre);");
cssApp = remplacerUneFois(cssApp, '--font-text: "Figtree", "Text Fallback", system-ui, sans-serif;', "--font-text: var(--police-texte);");
writeFileSync(
  join(racine, "app/maquette.css"),
  "/* Fichier généré par scripts/extraire-maquette.mjs depuis le CSS de la maquette : ne pas modifier\n" +
    "   à la main. Les ajouts propres au site vont dans app/site.css. */\n\n" +
    cssApp,
);

// ---------- 2. Scripts et JSON-LD ----------
const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const jsonld = scripts.filter((s) => /application\/ld\+json/.test(s[1] ?? ""));
const js = scripts.filter((s) => !/type=/.test(s[1] ?? ""));
if (jsonld.length !== 1 || js.length !== 2) throw new Error(`Scripts inattendus : ${jsonld.length} JSON-LD, ${js.length} JS`);
const ld = JSON.parse(jsonld[0][2]); // valide le JSON
ecrire("jsonld.json", JSON.stringify(ld, null, 2) + "\n");
ecrire("tete.js", js[0][2].trim() + "\n");
ecrire("principal.js", js[1][2].replace(/^\n/, ""));

// ---------- 3. Logo, sprite et favicon ----------
const sprite = unique(/<svg class="sprite"[^>]*>([\s\S]*?)<\/svg>/g, "Sprite SVG");
const defs = sprite[1].match(/<defs>([\s\S]*?)<\/defs>/)?.[1].trim();
if (!defs) throw new Error("<defs> du logo introuvables");
const symboleLogo = sprite[1].match(/<symbol id="logo" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/);
if (!symboleLogo) throw new Error("Symbole #logo introuvable");
const viewBox = symboleLogo[1];
const xmlns = 'xmlns="http://www.w3.org/2000/svg"';
ecrire("logo/logo.svg", `<svg ${xmlns} viewBox="${viewBox}" role="img" aria-label="Hope &amp; Peace Farm">\n<defs>${defs}</defs>\n${symboleLogo[2]}\n</svg>\n`);
ecrire("logo/logo-defs.svg", `<svg ${xmlns} aria-hidden="true" style="position:absolute;width:0;height:0">\n<defs>${defs}</defs>\n</svg>\n`);

const calques = [...defs.matchAll(/<(g|path|circle)\s+id="(lg-[^"]+)"/g)].map((m) => m[2]);
const degrades = [...defs.matchAll(/<(?:linear|radial)Gradient\s+id="([^"]+)"/g)].map((m) => m[1]);

const icones = [...sprite[1].matchAll(/<symbol id="(i-[^"]+)"[\s\S]*?<\/symbol>/g)];
ecrire("icones/sprite.svg", `<svg ${xmlns} aria-hidden="true">\n${icones.map((m) => m[0]).join("\n")}\n</svg>\n`);
for (const m of icones) {
  const [, id] = m;
  const corps = m[0].replace(/^<symbol id="[^"]+" (viewBox="[^"]+")>/, `<svg ${xmlns} $1 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`).replace(/<\/symbol>$/, "</svg>");
  ecrire(`icones/${id}.svg`, corps + "\n");
}

// Contenu exact du <svg class="sprite"> de la maquette, pour l'application (components/site/sprite.tsx).
const moduleSprite = [
  "// Fichier généré par scripts/extraire-maquette.mjs : ne pas modifier à la main.",
  "// Contenu exact du <svg class=\"sprite\"> de la maquette : dégradés et calques du logo (#lg-*),",
  "// symbole #logo et 24 icônes (#i-*).",
  "",
  `export const SPRITE = ${JSON.stringify(sprite[1])};`,
  "",
].join("\n");
writeFileSync(join(racine, "lib/site/sprite.ts"), moduleSprite);

const favicon = unique(/<link rel="icon" href="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/g, "Favicon");
ecrire("favicon.svg", Buffer.from(favicon[1], "base64"));

// ---------- 4. Structure lisible ----------
let structure = html
  .replace(style[0], `<style>/* voir styles.css */</style>`)
  .replace(favicon[0], `<link rel="icon" href="favicon.svg"`)
  .replace(`<defs>${sprite[1].match(/<defs>([\s\S]*?)<\/defs>/)[1]}</defs>`, "<defs><!-- dégradés et calques #lg-* : voir logo/logo-defs.svg --></defs>")
  .replace(js[1][0], "<script>/* voir principal.js */</script>");
if (/base64/.test(structure)) throw new Error("Il reste du base64 dans structure.html");
ecrire("structure.html", structure);

// ---------- 5. Manifeste ----------
const manifeste = {
  source: relative(racine, source).replaceAll("\\", "/"),
  sourceOctets: Buffer.byteLength(html),
  sourceSha256: sha256(readFileSync(source)),
  generePar: "scripts/extraire-maquette.mjs",
  polices,
  logo: { viewBox, calques, degrades: degrades.length },
  icones: icones.map((m) => m[1]),
  fichiers: fichiers.sort((a, b) => a.fichier.localeCompare(b.fichier)),
};
writeFileSync(join(sortie, "manifeste.json"), JSON.stringify(manifeste, null, 2) + "\n");

console.log(`Source : ${manifeste.source} (${manifeste.sourceOctets} octets, sha256 ${manifeste.sourceSha256.slice(0, 12)}…)`);
for (const f of manifeste.fichiers) console.log(`  ${f.fichier.padEnd(34)} ${String(f.octets).padStart(7)} o`);
console.log(`Polices : ${polices.map((p) => `${p.famille} ${p.graisse}`).join(", ")}`);
console.log(`Logo : ${calques.length} calques (${calques.join(", ")}), ${degrades.length} dégradés`);
console.log(`Icônes : ${icones.length}`);
