// Dernier contenu publié, gardé sur disque dans UPLOAD_DIR (persistant d’un
// déploiement à l’autre) : la page reste juste si la base est indisponible au
// moment d’un rendu. Le contenu est public (c’est la page) : aucun secret ici.
// Écrit seulement quand la version change ; relu et validé avant usage.

import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dossierTeleversement } from "@/lib/config";
import { codeErreur, journal } from "@/lib/journal";
import { schemaContenu } from "./schema";
import type { ContenuPage } from "./types";

function fichier(): string | null {
  try {
    return path.join(dossierTeleversement(), ".contenu", "publie.json");
  } catch {
    return null; // UPLOAD_DIR absent (compilation) : pas d’instantané
  }
}

let empreinteEcrite = "";

export async function ecrireInstantane(numero: number, empreinte: string, donnees: ContenuPage): Promise<void> {
  const chemin = fichier();
  if (!chemin || empreinte === empreinteEcrite) return;
  try {
    await mkdir(path.dirname(chemin), { recursive: true });
    const temporaire = `${chemin}.${process.pid}.tmp`;
    await writeFile(temporaire, JSON.stringify({ numero, empreinte, donnees }));
    await rename(temporaire, chemin); // écriture atomique
    empreinteEcrite = empreinte;
  } catch (e) {
    journal.avertissement("instantané du contenu non écrit", { erreur: codeErreur(e) });
  }
}

export async function lireInstantane(): Promise<{ numero: number; donnees: ContenuPage } | null> {
  const chemin = fichier();
  if (!chemin) return null;
  try {
    const brut = JSON.parse(await readFile(chemin, "utf8")) as { numero?: unknown; donnees?: unknown };
    const analyse = schemaContenu.safeParse(brut.donnees);
    if (!analyse.success || typeof brut.numero !== "number") return null;
    return { numero: brut.numero, donnees: analyse.data };
  } catch {
    return null;
  }
}
