// Description des champs de l’éditeur de contenus, déduite du schéma Zod du contenu
// (lib/contenu/schema.ts) : une seule définition des règles, que l’éditeur affiche
// (longueur maximale, obligatoire, bornes) et que le serveur applique à
// l’enregistrement. Les libellés et les aides viennent de lib/admin/libelles.ts.

import type { z } from "zod";
import { schemaContenu } from "@/lib/contenu/schema";
import { aideDe, libelleDe } from "./libelles";

export type Champ =
  | { genre: "texte"; chemin: string; libelle: string; aide?: string; max?: number; requis: boolean; long: boolean; format?: string }
  | { genre: "entier"; chemin: string; libelle: string; aide?: string; min?: number; max?: number }
  | { genre: "date"; chemin: string; libelle: string; aide?: string }
  | { genre: "booleen"; chemin: string; libelle: string; aide?: string }
  | { genre: "choix"; chemin: string; libelle: string; aide?: string; options: string[] }
  | { genre: "groupe"; chemin: string; libelle: string; aide?: string; enfants: Champ[]; liste: boolean };

type Def = {
  type: string;
  format?: string;
  checks?: { _zod: { def: { check: string; maximum?: number; minimum?: number; value?: number } } }[];
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  items?: z.ZodType[];
  options?: z.ZodType[];
  entries?: Record<string, string>;
  in?: z.ZodType;
};

const def = (s: z.ZodType) => (s as unknown as { _zod: { def: Def } })._zod.def;
const verifs = (d: Def) => (d.checks ?? []).map((c) => c._zod.def);

/** Schéma « réel » d’une union « vide ou valeur » (videOu) : la variante non vide. */
function deballer(s: z.ZodType): { schema: z.ZodType; videPermis: boolean } {
  const d = def(s);
  if (d.type === "union" && d.options?.length === 2) {
    const autre = d.options.find((o) => def(o).type !== "literal");
    if (autre) return { schema: autre, videPermis: true };
  }
  if (d.type === "pipe" && d.in) return deballer(d.in);
  return { schema: s, videPermis: false };
}

/** Vrai si le schéma accepte une chaîne vide (un raffinement peut lever une exception : refus). */
function accepteVide(s: z.ZodType): boolean {
  try {
    return s.safeParse("").success;
  } catch {
    return false;
  }
}

function decrire(s: z.ZodType, chemin: string, valeur: unknown): Champ {
  const { schema, videPermis } = deballer(s);
  const d = def(schema);
  const libelle = libelleDe(chemin);
  const aide = aideDe(chemin);
  switch (d.type) {
    case "string": {
      if (d.format === "date") return { genre: "date", chemin, libelle, aide };
      const max = verifs(d).find((c) => c.check === "max_length")?.maximum;
      const requis = !videPermis && !accepteVide(s);
      const long = (max ?? 0) > 160 || (typeof valeur === "string" && valeur.includes("\n"));
      return { genre: "texte", chemin, libelle, aide, max, requis, long, format: d.format };
    }
    case "number": {
      const c = verifs(d);
      return { genre: "entier", chemin, libelle, aide, min: c.find((x) => x.check === "greater_than")?.value, max: c.find((x) => x.check === "less_than")?.value };
    }
    case "boolean":
      return { genre: "booleen", chemin, libelle, aide };
    case "enum":
      return { genre: "choix", chemin, libelle, aide, options: Object.values(d.entries ?? {}) };
    case "object": {
      const v = (valeur ?? {}) as Record<string, unknown>;
      const enfants = Object.entries(d.shape ?? {}).map(([k, e]) => decrire(e, chemin ? `${chemin}.${k}` : k, v[k]));
      return { genre: "groupe", chemin, libelle, aide, enfants, liste: false };
    }
    case "array":
    case "tuple": {
      const v = Array.isArray(valeur) ? valeur : [];
      const element = (i: number) => (d.type === "tuple" ? d.items![i]! : d.element!);
      const enfants = v.map((e, i) => decrire(element(i), `${chemin}[${i}]`, e));
      return { genre: "groupe", chemin, libelle, aide, enfants, liste: true };
    }
    default:
      if (d.format === "date" || d.type === "date") return { genre: "date", chemin, libelle, aide };
      return { genre: "texte", chemin, libelle, aide, requis: false, long: false };
  }
}

const formeContenu = def(schemaContenu as unknown as z.ZodType).shape!;

/** Groupes de la page, dans l’ordre du back-office. */
export const GROUPES = Object.keys(formeContenu) as (keyof typeof formeContenu & string)[];

/** Champs d’un groupe, avec le nombre d’éléments des listes tel qu’il est dans `valeurs`. */
export function champsDuGroupe(groupe: string, valeurs: unknown): Champ[] {
  const s = formeContenu[groupe];
  if (!s) return [];
  const champ = decrire(s, groupe, valeurs);
  return champ.genre === "groupe" ? champ.enfants : [champ];
}

/** Toutes les feuilles (champs saisissables) d’un arbre de champs. */
export function feuilles(champs: Champ[]): Exclude<Champ, { genre: "groupe" }>[] {
  return champs.flatMap((c) => (c.genre === "groupe" ? feuilles(c.enfants) : [c]));
}

// ---------------------------------------------------------------------------
// Lecture et écriture d’une valeur par son chemin (« a.b[2].c »)

const segments = (chemin: string) => (chemin.match(/[^.[\]]+/g) ?? []).map((s) => (/^\d+$/.test(s) ? Number(s) : s));

export function lireChemin(document: unknown, chemin: string): unknown {
  let courant: unknown = document;
  for (const s of segments(chemin)) {
    if (courant === null || typeof courant !== "object") return undefined;
    courant = (courant as Record<string | number, unknown>)[s];
  }
  return courant;
}

/** Copie du document avec la valeur remplacée (le chemin doit exister). */
export function ecrireChemin<T>(document: T, chemin: string, valeur: unknown): T {
  const [tete, ...reste] = segments(chemin);
  if (tete === undefined) return valeur as T;
  const copie = (Array.isArray(document) ? [...document] : { ...(document as object) }) as Record<string | number, unknown>;
  if (!(tete in copie)) throw new Error(`Chemin inconnu : ${chemin}`);
  copie[tete] = reste.length ? ecrireChemin(copie[tete], reste.join("."), valeur) : valeur;
  return copie as T;
}

/** Chemin « livraison.zones[0].nom » → chemin de premier niveau « livraison.zones » (marque « à confirmer »). */
export function cheminPremierNiveau(chemin: string): string {
  const s = segments(chemin);
  return s.slice(0, 2).filter((x) => typeof x === "string").join(".");
}
