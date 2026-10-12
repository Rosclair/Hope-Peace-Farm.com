// Revalidation du contenu publié, pour les publications faites hors du back-office
// (ligne de commande : npm run contenu). Le back-office appellera la même fonction
// depuis ses actions serveur (phase 5). Sans cet appel, la page suit quand même la
// base en 30 s à 5 min (lib/contenu/profil.ts). Répond une fois la page à jour (≈ 2 s).
// curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/contenu/revalider

import { connection } from "next/server";
import { ETIQUETTE_CONTENU } from "@/lib/contenu/profil";
import { revaliderContenu } from "@/lib/contenu/revalidation";
import { journal } from "@/lib/journal";
import { accesAutorise, SANS_CACHE } from "@/lib/securite/acces";

export async function POST(requete: Request) {
  await connection();
  if (!accesAutorise(requete, "CRON_SECRET")) {
    return Response.json({ erreur: "non autorisé" }, { status: 401, headers: SANS_CACHE });
  }
  await revaliderContenu();
  journal.info("contenu revalidé", { origine: "api" });
  return Response.json({ revalide: ETIQUETTE_CONTENU }, { headers: SANS_CACHE });
}
