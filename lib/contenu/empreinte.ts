// Empreinte d’un document de contenu : SHA-256 de son JSON canonique (clés triées),
// indépendante de l’ordre des clés renvoyé par la base.

import { createHash } from "node:crypto";

function canonique(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(canonique);
  if (valeur && typeof valeur === "object") {
    return Object.fromEntries(
      Object.keys(valeur)
        .sort()
        .map((k) => [k, canonique((valeur as Record<string, unknown>)[k])]),
    );
  }
  return valeur;
}

export function empreinteContenu(donnees: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonique(donnees))).digest("hex");
}
