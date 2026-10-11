// Fichiers téléversés dans UPLOAD_DIR (hors du dossier de déploiement).
// Les chemins publics sont limités à des segments simples en minuscules :
// aucun moyen de sortir du dossier (« .. », séparateurs, caractères spéciaux).

import path from "node:path";

const SEGMENT = /^[a-z0-9][a-z0-9-]{0,99}$/;
const FICHIER = /^[a-z0-9][a-z0-9-]{0,99}\.webp$/;

/**
 * Chemin absolu d’un média à partir des segments de son URL publique
 * (`/medias/a/b.webp` → `["a", "b.webp"]`), ou `null` si les segments sont invalides.
 */
export function cheminMedia(racine: string, segments: readonly string[]): string | null {
  if (segments.length === 0 || segments.length > 4) return null;
  const dossiers = segments.slice(0, -1);
  const fichier = segments[segments.length - 1]!;
  if (!dossiers.every((s) => SEGMENT.test(s)) || !FICHIER.test(fichier)) return null;
  const base = path.resolve(racine);
  const complet = path.resolve(base, ...segments);
  return complet.startsWith(base + path.sep) ? complet : null;
}

/** Vrai si `dossier` est dans `parent` (ou égal) : sert à refuser UPLOAD_DIR dans le déploiement. */
export function estDans(dossier: string, parent: string): boolean {
  const relatif = path.relative(path.resolve(parent), path.resolve(dossier));
  return relatif === "" || (!relatif.startsWith("..") && !path.isAbsolute(relatif));
}
