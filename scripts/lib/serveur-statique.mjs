// Petit serveur HTTP local pour mesurer la maquette dans des conditions proches
// de la production : compression brotli ou gzip selon Accept-Encoding,
// en-têtes de cache et types MIME corrects. Écoute sur 127.0.0.1, port libre.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg"]);

/**
 * @param {string} dossier  racine servie
 * @param {string} indexFichier  fichier renvoyé pour « / »
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function demarrerServeur(dossier, indexFichier) {
  const racine = resolve(dossier);
  const cache = new Map();

  const server = createServer(async (req, res) => {
    try {
      const chemin = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
      const relatif = chemin === "/" ? indexFichier : chemin.slice(1);
      const complet = normalize(join(racine, relatif));
      if (!complet.startsWith(racine + sep)) throw Object.assign(new Error("hors racine"), { code: "ENOENT" });
      const ext = extname(complet).toLowerCase();
      const brut = await readFile(complet);
      const accepte = String(req.headers["accept-encoding"] ?? "");
      let corps = brut;
      let encodage = "";
      if (COMPRESSIBLE.has(ext)) {
        if (/\bbr\b/.test(accepte)) {
          encodage = "br";
          const cle = `${complet}|br`;
          if (!cache.has(cle)) cache.set(cle, brotliCompressSync(brut, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
          corps = cache.get(cle);
        } else if (/\bgzip\b/.test(accepte)) {
          encodage = "gzip";
          const cle = `${complet}|gz`;
          if (!cache.has(cle)) cache.set(cle, gzipSync(brut, { level: 9 }));
          corps = cache.get(cle);
        }
      }
      res.writeHead(200, {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Content-Length": corps.length,
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(encodage ? { "Content-Encoding": encodage, Vary: "Accept-Encoding" } : {}),
      });
      res.end(req.method === "HEAD" ? undefined : corps);
    } catch (e) {
      res.writeHead(e?.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(e?.code === "ENOENT" ? "Introuvable" : "Erreur");
    }
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
  return {
    url: `http://127.0.0.1:${port}/`,
    // closeAllConnections : sinon close() attend que le navigateur libère ses connexions persistantes
    close: () => new Promise((ok) => { server.close(() => ok()); server.closeAllConnections(); }),
  };
}
