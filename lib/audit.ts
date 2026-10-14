// Journal d’audit (brief §4.9) : qui a changé quoi et quand, avec l’avant et l’après.
// Règles : valeurs sensibles masquées (numéros, e-mails), jamais de donnée d’un
// client en clair (une note interne est journalisée sans son texte, une suppression
// sans la donnée supprimée), adresse IP remplacée par son empreinte.

import "server-only";
import { db } from "@/lib/db/client";
import { journalAudit } from "@/lib/db/schema";
import { codeErreur, journal } from "@/lib/journal";
import { empreinteIp } from "@/lib/auth/serveur";

export { CHEMINS_SENSIBLES, masquerEmail, masquerNumero, valeurJournal } from "@/lib/admin/masque";

export interface EntreeAudit {
  utilisateurId: string | null;
  action: string;
  cibleType?: string;
  cibleId?: string;
  avant?: unknown;
  apres?: unknown;
  entetes?: Headers | null;
}

/**
 * Écrit une ligne au journal. Une panne d’écriture est signalée au journal
 * applicatif mais n’annule pas l’action déjà faite.
 */
export async function ecrireAudit(e: EntreeAudit): Promise<void> {
  try {
    await db()
      .insert(journalAudit)
      .values({
        utilisateurId: e.utilisateurId,
        action: e.action.slice(0, 60),
        cibleType: e.cibleType?.slice(0, 40) ?? null,
        cibleId: e.cibleId?.slice(0, 120) ?? null,
        avant: e.avant === undefined ? null : e.avant,
        apres: e.apres === undefined ? null : e.apres,
        empreinteIp: empreinteIp(e.entetes),
      });
  } catch (erreur) {
    journal.erreur("journal d’audit : écriture impossible", { action: e.action, erreur: codeErreur(erreur) });
  }
}
