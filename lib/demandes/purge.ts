// Conservation des demandes (brief §6, loi n° 2024/017) : une demande est supprimée
// définitivement, avec son historique et ses e-mails (clés étrangères en cascade),
// quand sa dernière mise à jour dépasse la durée de conservation (12 mois par défaut,
// réglable dans le back-office).

import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { demande } from "@/lib/db/schema";
import { conservationMois } from "@/lib/reglages";

export async function purgerDemandes(mois?: number): Promise<number> {
  mois ??= await conservationMois();
  const [r] = await db()
    .delete(demande)
    .where(lt(demande.majLe, sql`CURRENT_TIMESTAMP(3) - INTERVAL ${mois} MONTH`));
  return r.affectedRows;
}
