import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTEUR_IMMEDIAT } from "@/lib/site/moteur-immediat";
import { dateLongue, fcfa, lienTelephone, nombre, telephoneAffiche } from "@/lib/contenu/format";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import { analyser, REPERES, reperesCites, RepereInconnu, textePlat, valeurRepere } from "@/lib/contenu/reperes";
import { SPRITE } from "@/lib/site/sprite";

const NBSP = " ";

/** Toutes les chaînes d’un objet, avec leur chemin. */
function chaines(valeur: unknown, chemin = ""): [string, string][] {
  if (typeof valeur === "string") return [[chemin, valeur]];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => chaines(v, `${chemin}[${i}]`));
  if (valeur && typeof valeur === "object") return Object.entries(valeur).flatMap(([k, v]) => chaines(v, chemin ? `${chemin}.${k}` : k));
  return [];
}

describe("mise en forme des valeurs", () => {
  it("écrit les prix et les nombres avec des espaces insécables, comme la maquette", () => {
    expect(fcfa(3400)).toBe(`3${NBSP}400${NBSP}FCFA`);
    expect(fcfa(340000)).toBe(`340${NBSP}000${NBSP}FCFA`);
    expect(fcfa(500)).toBe(`500${NBSP}FCFA`);
    expect(nombre(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(nombre(100)).toBe("100");
  });

  it("écrit les dates en toutes lettres, « 1er » pour le premier du mois", () => {
    expect(dateLongue("2026-11-01")).toBe(`1er${NBSP}novembre 2026`);
    expect(dateLongue("2026-12-15")).toBe(`15${NBSP}décembre 2026`);
    expect(() => dateLongue("2026-13-01")).toThrow();
    expect(() => dateLongue("15/12/2026")).toThrow();
  });

  it("groupe les numéros camerounais comme la maquette", () => {
    expect(telephoneAffiche("237693645565")).toBe(["+237", "693", "64", "55", "65"].join(NBSP));
    expect(telephoneAffiche("+237693645565")).toBe(["+237", "693", "64", "55", "65"].join(NBSP));
    expect(telephoneAffiche("+33612345678")).toBe("+33612345678");
    expect(lienTelephone("+237 693 64 55 65")).toBe("tel:+237693645565");
  });
});

describe("textes riches", () => {
  it("découpe repères, gras et liens d’ancre", () => {
    expect(analyser("Notre seul numéro : **{coordonnees.whatsapp}**.")).toEqual([
      { type: "texte", texte: "Notre seul numéro : " },
      { type: "gras", morceaux: [{ type: "repere", chemin: "coordonnees.whatsapp" }] },
      { type: "texte", texte: "." },
    ]);
    expect(analyser("C’est la [formule Cérémonie](#ceremonies).")).toEqual([
      { type: "texte", texte: "C’est la " },
      { type: "lien", ancre: "#ceremonies", morceaux: [{ type: "texte", texte: "formule Cérémonie" }] },
      { type: "texte", texte: "." },
    ]);
  });

  it("remplace les repères par les valeurs mises en forme", () => {
    expect(textePlat(CONTENU_INITIAL, "À partir de {prix.pretACuire}")).toBe(`À partir de 3${NBSP}400${NBSP}FCFA`);
    expect(textePlat(CONTENU_INITIAL, "avant le {fetes.dateLimitePrixGaranti}.")).toBe(`avant le 1er${NBSP}novembre 2026.`);
    expect(valeurRepere(CONTENU_INITIAL, "coordonnees.whatsapp").telephone).toBe(true);
  });

  it("refuse un repère inconnu", () => {
    expect(() => textePlat(CONTENU_INITIAL, "{prix.inexistant}")).toThrow(RepereInconnu);
  });

  it("chaque repère déclaré se résout sur le contenu initial", () => {
    for (const chemin of Object.keys(REPERES)) expect(() => valeurRepere(CONTENU_INITIAL, chemin)).not.toThrow();
  });
});

describe("contenu initial (= maquette)", () => {
  const toutes = chaines(CONTENU_INITIAL);

  it("ne cite que des repères connus", () => {
    const inconnus = toutes.flatMap(([chemin, t]) => reperesCites(t).filter((r) => !(r in REPERES)).map((r) => `${chemin} : {${r}}`));
    expect(inconnus).toEqual([]);
  });

  it("ne contient ni marque « ~ » oubliée, ni « […] » à renseigner, ni apostrophe droite", () => {
    expect(toutes.filter(([, t]) => t.includes("~"))).toEqual([]);
    expect(toutes.filter(([, t]) => /\[[^\]]*\](?!\(#)/.test(t))).toEqual([]);
    expect(toutes.filter(([, t]) => t.includes("'"))).toEqual([]);
  });

  it("met une espace insécable avant « : ; ? ! » dans les textes de la page", () => {
    // Les attributs de la maquette (description, JSON-LD) gardent des espaces simples.
    const attributs = new Set(["seo.description", "seo.descriptionEntreprise", "seo.titre"]);
    const fautes = toutes.filter(([chemin, t]) => !attributs.has(chemin) && / [:;?!]/.test(t));
    expect(fautes).toEqual([]);
  });
});

describe("ressources de la maquette", () => {
  const maquette = readFileSync("reference/hope-and-peace-farm-apercu-2.html", "utf8");

  it("le sprite SVG (logo et icônes) est celui de la maquette, à l’identique", () => {
    const sprite = /<svg class="sprite"[^>]*>([\s\S]*?)<\/svg>/.exec(maquette)?.[1];
    expect(SPRITE).toBe(sprite);
  });

  it("le moteur immédiat en ligne est à jour avec ses sources (lib/moteur)", () => {
    const r = spawnSync(process.execPath, ["scripts/construire-moteur.mjs", "--verifier"], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(MOTEUR_IMMEDIAT).not.toMatch(/<\/script/i);
  });

  it("app/maquette.css est le CSS de la maquette, polices mises à part", () => {
    const reference = readFileSync("reference/extrait/styles.css", "utf8");
    const app = readFileSync("app/maquette.css", "utf8");
    const attendu = reference
      .replace(/@font-face\s*\{[^}]*url\("polices\/[^}]*\}\n/, "/* Polices : déclarées par next/font/local (app/polices.ts), mêmes fichiers WOFF2. */\n")
      .replace(/@font-face\s*\{[^}]*url\("polices\/[^}]*\}\n/g, "")
      .replace('--font-display: "Bricolage Grotesque", "Display Fallback", Arial, sans-serif;', "--font-display: var(--police-titre);")
      .replace('--font-text: "Figtree", "Text Fallback", system-ui, sans-serif;', "--font-text: var(--police-texte);");
    expect(app.slice(app.indexOf("/* ====="))).toBe(attendu.slice(attendu.indexOf("/* =====")));
  });
});
