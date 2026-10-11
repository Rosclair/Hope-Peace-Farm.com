// Marqueur de persistance d’UPLOAD_DIR : à chaque démarrage, l’identifiant de
// la compilation est ajouté à un petit fichier JSON du dossier. Si, après un
// nouveau déploiement, le fichier contient encore l’identifiant précédent, le
// dossier a survécu au déploiement (hypothèse Hostinger n° 2, architecture §16).

import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type Marqueur = { creeLe: string; builds: { build: string; vuLe: string }[] };

const fichierMarqueur = (racine: string) => path.join(racine, ".diagnostic", "persistance.json");

export async function lireMarqueur(racine: string): Promise<Marqueur | null> {
  try {
    const donnees = JSON.parse(await readFile(fichierMarqueur(racine), "utf8")) as Marqueur;
    return Array.isArray(donnees.builds) ? donnees : null;
  } catch {
    return null;
  }
}

export async function noterBuild(racine: string, build: string): Promise<Marqueur> {
  const fichier = fichierMarqueur(racine);
  await mkdir(path.dirname(fichier), { recursive: true });
  const maintenant = new Date().toISOString();
  const marqueur = (await lireMarqueur(racine)) ?? { creeLe: maintenant, builds: [] };
  if (marqueur.builds.at(-1)?.build !== build) {
    marqueur.builds = [...marqueur.builds, { build, vuLe: maintenant }].slice(-20);
    const temporaire = `${fichier}.${process.pid}.tmp`;
    await writeFile(temporaire, JSON.stringify(marqueur, null, 2), "utf8");
    await rename(temporaire, fichier);
  }
  return marqueur;
}
