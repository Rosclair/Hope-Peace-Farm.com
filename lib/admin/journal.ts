// Lecture du journal d’audit pour le back-office (tableau de bord ; la page complète
// du journal arrive en phase 6).

import "server-only";
import { desc, eq, like, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { journalAudit, utilisateur } from "@/lib/db/schema";

export const LIBELLES_ACTION: Record<string, string> = {
  "contenu.modifier": "Contenu modifié",
  "contenu.publier": "Publication",
  "contenu.restaurer": "Retour arrière",
  "contenu.a_confirmer": "Marque « à confirmer »",
  "reglage.modifier": "Réglage modifié",
  "securite.totp_active": "Second facteur activé",
  "securite.codes_regeneres": "Codes de secours renouvelés",
  "securite.mot_de_passe": "Mot de passe changé",
  "compte.inviter": "Invitation envoyée",
  "compte.creer": "Compte créé",
  "compte.activation": "Compte activé ou désactivé",
};

/** Dernières modifications du site et des réglages (pas les connexions ni les demandes). */
export async function dernieresModifications(limite = 8) {
  return db()
    .select({ id: journalAudit.id, le: journalAudit.le, action: journalAudit.action, cibleId: journalAudit.cibleId, auteur: utilisateur.name })
    .from(journalAudit)
    .leftJoin(utilisateur, eq(utilisateur.id, journalAudit.utilisateurId))
    .where(or(like(journalAudit.action, "contenu.%"), like(journalAudit.action, "reglage.%"), like(journalAudit.action, "compte.%")))
    .orderBy(desc(journalAudit.le), desc(journalAudit.id))
    .limit(limite);
}
