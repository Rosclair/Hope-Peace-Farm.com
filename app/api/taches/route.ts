// Point d’entrée des tâches planifiées, appelé par le cron toutes les 15 minutes :
// curl -fsS -m 120 -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/taches

import { connection } from "next/server";
import { codeErreur, journal } from "@/lib/journal";
import { accesAutorise, SANS_CACHE } from "@/lib/securite/acces";
import { executerTachesDues } from "@/lib/taches/executer";

export async function POST(requete: Request) {
  await connection();
  if (!accesAutorise(requete, "CRON_SECRET")) {
    return Response.json({ erreur: "non autorisé" }, { status: 401, headers: SANS_CACHE });
  }
  try {
    const bilan = await executerTachesDues("cron");
    const echec = bilan.taches.some((t) => t.statut === "echec");
    return Response.json(bilan, { status: echec ? 500 : 200, headers: SANS_CACHE });
  } catch (e) {
    journal.erreur("passage des tâches impossible", { erreur: codeErreur(e) });
    return Response.json({ erreur: codeErreur(e) }, { status: 500, headers: SANS_CACHE });
  }
}
