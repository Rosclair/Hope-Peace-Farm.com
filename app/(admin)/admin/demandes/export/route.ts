// Export CSV des demandes filtrées (brief §4.3). Lecture seule, réservée aux comptes
// connectés avec le second facteur ; jamais en cache. L’export est journalisé.

import { headers } from "next/headers";
import { exporterCsv, schemaFiltres } from "@/lib/admin/demandes";
import { ecrireAudit } from "@/lib/audit";
import { lireCompte } from "@/lib/auth/session";

export async function GET(requete: Request) {
  const compte = await lireCompte();
  if (!compte || !compte.deuxFacteurs) return new Response("Connexion requise.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const f = schemaFiltres.parse(Object.fromEntries(new URL(requete.url).searchParams));
  const { csv, nombre } = await exporterCsv(f);
  const { page: _p, ...filtres } = f;
  await ecrireAudit({ utilisateurId: compte.id, action: "demande.exporter", cibleType: "demande", apres: { nombre, filtres }, entetes: await headers() });
  const jour = new Date(Date.now() + 36e5).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="demandes-${jour}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
