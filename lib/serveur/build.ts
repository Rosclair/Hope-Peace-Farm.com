// Identifiant de la compilation en cours (fichier .next/BUILD_ID, présent aussi
// dans la sortie standalone). Sert à repérer les déploiements successifs.

import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

let memo: string | undefined;

export function identifiantBuild(): string {
  if (memo === undefined) {
    if (process.env.NODE_ENV !== "production") memo = "developpement";
    else {
      try {
        memo = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "inconnu";
      } catch {
        memo = "inconnu";
      }
    }
  }
  return memo;
}

/** Version utilisable dans un nom de fichier public (`[a-z0-9-]`). */
export function identifiantBuildFichier(): string {
  return (
    identifiantBuild()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "inconnu"
  );
}
