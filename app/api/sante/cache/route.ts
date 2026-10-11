// Revalide la page témoin /diagnostic/cache (jeton DIAGNOSTIC_SECRET).

import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { accesAutorise, SANS_CACHE } from "@/lib/securite/acces";

export async function POST(requete: Request) {
  await connection();
  if (!accesAutorise(requete, "DIAGNOSTIC_SECRET")) {
    return Response.json({ erreur: "non autorisé" }, { status: 401, headers: SANS_CACHE });
  }
  revalidateTag("diagnostic-cache", { expire: 0 });
  return Response.json({ revalide: "diagnostic-cache", le: new Date().toISOString() }, { headers: SANS_CACHE });
}
