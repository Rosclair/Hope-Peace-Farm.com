// Fichiers WebP de UPLOAD_DIR. Noms aléatoires et immuables (une photo modifiée
// reçoit un nouveau nom) : cache d’un an côté navigateur.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { connection } from "next/server";
import { dossierTeleversement } from "@/lib/config";
import { cheminMedia } from "@/lib/medias/stockage";

const introuvable = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_requete: Request, { params }: { params: Promise<{ chemin: string[] }> }) {
  await connection();
  const { chemin } = await params;
  let fichier: string | null;
  try {
    fichier = cheminMedia(dossierTeleversement(), chemin);
  } catch {
    return introuvable();
  }
  if (!fichier) return introuvable();
  try {
    const infos = await stat(fichier);
    if (!infos.isFile()) return introuvable();
    const flux = Readable.toWeb(createReadStream(fichier)) as ReadableStream<Uint8Array>;
    return new Response(flux, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(infos.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return introuvable();
  }
}
