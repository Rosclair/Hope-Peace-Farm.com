// Réglages modifiables dans le back-office, hors du contenu publié (docs/modele-donnees.md
// §2) : e-mail de notification (sensible : code TOTP, e-mail d’alerte, journal) et
// durée de conservation des demandes. Sans réglage en base, les valeurs de .env
// s’appliquent (NOTIFICATION_EMAIL, DEMANDES_CONSERVATION_MOIS).

import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { configDemandes, configSmtp } from "@/lib/config";
import { db } from "@/lib/db/client";
import { reglage } from "@/lib/db/schema";

export const SCHEMAS_REGLAGES = {
  emailNotification: z.email({ error: "Adresse e-mail invalide." }).max(254),
  conservationMois: z.number().int("Nombre entier attendu.").min(1, "1 mois au moins.").max(120, "120 mois au plus."),
} as const;
export type CleReglage = keyof typeof SCHEMAS_REGLAGES;
type Valeur<K extends CleReglage> = z.output<(typeof SCHEMAS_REGLAGES)[K]>;

export async function lireReglage<K extends CleReglage>(cle: K): Promise<Valeur<K> | null> {
  const [ligne] = await db().select({ valeur: reglage.valeur }).from(reglage).where(eq(reglage.cle, cle)).limit(1);
  if (!ligne) return null;
  const analyse = SCHEMAS_REGLAGES[cle].safeParse(ligne.valeur);
  return analyse.success ? (analyse.data as Valeur<K>) : null;
}

export async function ecrireReglage<K extends CleReglage>(cle: K, valeur: Valeur<K>, par: string): Promise<void> {
  const v = SCHEMAS_REGLAGES[cle].parse(valeur);
  await db()
    .insert(reglage)
    .values({ cle, valeur: v, modifiePar: par })
    .onDuplicateKeyUpdate({ set: { valeur: v, modifiePar: par, modifieLe: sql`CURRENT_TIMESTAMP(3)` } });
}

/** Adresse des notifications : réglage du back-office, sinon NOTIFICATION_EMAIL ; null sans SMTP. */
export async function adresseNotification(): Promise<string | null> {
  let defaut: string;
  try {
    defaut = configSmtp().notification;
  } catch {
    return null;
  }
  try {
    return (await lireReglage("emailNotification")) ?? defaut;
  } catch {
    return defaut;
  }
}

/** Durée de conservation des demandes, en mois. */
export async function conservationMois(): Promise<number> {
  try {
    return (await lireReglage("conservationMois")) ?? configDemandes().conservationMois;
  } catch {
    return configDemandes().conservationMois;
  }
}
