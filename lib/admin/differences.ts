// Différences entre deux documents de contenu (brouillon et version en ligne), par
// chemin de feuille : ce que la publication va changer.

function aplatir(valeur: unknown, chemin: string, sortie: Map<string, unknown>): Map<string, unknown> {
  if (Array.isArray(valeur)) valeur.forEach((v, i) => aplatir(v, `${chemin}[${i}]`, sortie));
  else if (valeur && typeof valeur === "object") for (const [k, v] of Object.entries(valeur)) aplatir(v, chemin ? `${chemin}.${k}` : k, sortie);
  else sortie.set(chemin, valeur);
  return sortie;
}

export interface Difference {
  chemin: string;
  avant: unknown;
  apres: unknown;
}

export function differences(avant: unknown, apres: unknown): Difference[] {
  const a = aplatir(avant, "", new Map());
  const b = aplatir(apres, "", new Map());
  const chemins = new Set([...a.keys(), ...b.keys()]);
  return [...chemins].filter((c) => a.get(c) !== b.get(c)).map((c) => ({ chemin: c, avant: a.get(c), apres: b.get(c) }));
}
