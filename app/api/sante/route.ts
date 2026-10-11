// État de l’application. Sans jeton : réponse minimale (l’application répond).
// Avec le jeton DIAGNOSTIC_SECRET (en-tête Authorization: Bearer, ou ?jeton=
// pour un contrôle depuis un navigateur) : rapport complet de l’hébergement.

import { connection } from "next/server";
import { rapportComplet } from "@/lib/diagnostic/rapport";
import { accesAutorise, SANS_CACHE } from "@/lib/securite/acces";

export async function GET(requete: Request) {
  await connection();
  if (!accesAutorise(requete, "DIAGNOSTIC_SECRET", { jetonDansUrl: true })) {
    return Response.json({ statut: "en_ligne" }, { headers: SANS_CACHE });
  }
  return Response.json(await rapportComplet(requete.headers), { headers: SANS_CACHE });
}
