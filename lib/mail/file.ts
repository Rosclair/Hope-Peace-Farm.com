// File d’envoi des e-mails (architecture §7) : un e-mail est d’abord écrit en
// base, puis envoyé. En cas d’échec, nouvelles tentatives espacées ; après la
// cinquième, statut « echec » (visible au tableau de bord en phase 5).
// Une ligne est « réservée » par une mise à jour conditionnelle avant l’envoi :
// deux exécutions simultanées (tâche planifiée et envoi immédiat) ne peuvent pas
// envoyer deux fois le même e-mail.
// Toutes les dates de la file viennent de l’horloge de la base (CURRENT_TIMESTAMP) :
// celle de Node peut différer de quelques millisecondes (15 ms mesurées en local),
// assez pour qu’un e-mail tout juste mis en file ne soit pas encore « dû ».

import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailSortant, type TYPES_EMAIL } from "@/lib/db/schema";
import { codeErreur, journal } from "@/lib/journal";
import { expediteur, transport } from "./transport";

export const TENTATIVES_MAX = 5;
/** Délai (minutes) avant la tentative suivante, selon le nombre de tentatives déjà faites. */
const DELAIS_MINUTES = [1, 5, 15, 60] as const;
/** Durée de réservation d’une ligne pendant l’envoi. */
const RESERVATION_MINUTES = 10;

const maintenantBase = sql`CURRENT_TIMESTAMP(3)`;
const dansMinutesBase = (minutes: number) => sql`CURRENT_TIMESTAMP(3) + INTERVAL ${minutes} MINUTE`;

export function delaiAvantNouvelleTentative(tentativesFaites: number): number | null {
  if (tentativesFaites >= TENTATIVES_MAX) return null;
  return DELAIS_MINUTES[Math.max(0, tentativesFaites - 1)] ?? DELAIS_MINUTES[DELAIS_MINUTES.length - 1]!;
}

type NouvelEmail = {
  type: (typeof TYPES_EMAIL)[number];
  destinataire: string;
  sujet: string;
  texte: string;
  html?: string;
};

export async function mettreEnFile(email: NouvelEmail): Promise<number> {
  const [resultat] = await db()
    .insert(emailSortant)
    .values({ ...email, html: email.html ?? null });
  return resultat.insertId;
}

export type ResultatEnvoi = "envoye" | "nouvelle_tentative" | "echec" | "non_reserve";

/** Réserve puis envoie un e-mail de la file. */
export async function envoyerEmail(id: number): Promise<ResultatEnvoi> {
  const [reservation] = await db()
    .update(emailSortant)
    .set({ prochaineTentativeLe: dansMinutesBase(RESERVATION_MINUTES) })
    .where(and(eq(emailSortant.id, id), eq(emailSortant.statut, "en_attente"), lte(emailSortant.prochaineTentativeLe, maintenantBase)));
  if (reservation.affectedRows !== 1) return "non_reserve";

  const [email] = await db().select().from(emailSortant).where(eq(emailSortant.id, id)).limit(1);
  if (!email) return "non_reserve";

  try {
    await transport().sendMail({
      from: expediteur(),
      to: email.destinataire,
      subject: email.sujet,
      text: email.texte,
      ...(email.html ? { html: email.html } : {}),
    });
    await db()
      .update(emailSortant)
      .set({ statut: "envoye", envoyeLe: maintenantBase, tentatives: sql`${emailSortant.tentatives} + 1`, derniereErreur: null })
      .where(eq(emailSortant.id, id));
    journal.info("e-mail envoyé", { email: id, type: email.type });
    return "envoye";
  } catch (e) {
    const tentatives = email.tentatives + 1;
    const delai = delaiAvantNouvelleTentative(tentatives);
    const erreur = codeErreur(e);
    await db()
      .update(emailSortant)
      .set({
        tentatives,
        derniereErreur: erreur,
        ...(delai === null
          ? { statut: "echec" as const }
          : { prochaineTentativeLe: dansMinutesBase(delai) }),
      })
      .where(eq(emailSortant.id, id));
    journal.avertissement("échec d’envoi d’e-mail", { email: id, type: email.type, tentatives, erreur });
    return delai === null ? "echec" : "nouvelle_tentative";
  }
}

/** Envoie les e-mails dus (tâche planifiée « emails »). */
export async function traiterFileEmails(limite = 20): Promise<Record<ResultatEnvoi, number>> {
  const dus = await db()
    .select({ id: emailSortant.id })
    .from(emailSortant)
    .where(and(eq(emailSortant.statut, "en_attente"), lte(emailSortant.prochaineTentativeLe, maintenantBase)))
    .orderBy(asc(emailSortant.id))
    .limit(limite);
  const bilan: Record<ResultatEnvoi, number> = { envoye: 0, nouvelle_tentative: 0, echec: 0, non_reserve: 0 };
  for (const { id } of dus) bilan[await envoyerEmail(id)] += 1;
  return bilan;
}
