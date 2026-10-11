// Tâches planifiées (architecture §8). Un seul point d’entrée, appelé par le
// cron (POST /api/taches) et, en secours, par un minuteur interne. Chaque tâche
// a un intervalle minimal ; chaque exécution est inscrite dans `tache_execution`.
// Un verrou MySQL empêche deux passages simultanés.

import "server-only";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { avecVerrou, db } from "@/lib/db/client";
import { demarrageServeur, emailSortant, tacheExecution, type DECLENCHEURS_TACHE } from "@/lib/db/schema";
import { codeErreur, journal } from "@/lib/journal";
import { traiterFileEmails } from "@/lib/mail/file";

export type Declencheur = (typeof DECLENCHEURS_TACHE)[number];

type Tache = {
  nom: string;
  /** Intervalle minimal entre deux exécutions réussies, en minutes (0 : à chaque passage). */
  intervalleMinutes: number;
  executer: () => Promise<string>;
};

const JOUR = 24 * 60;
const ilYa = (jours: number) => new Date(Date.now() - jours * JOUR * 60_000);

export const TACHES: readonly Tache[] = [
  {
    nom: "emails",
    intervalleMinutes: 0,
    executer: async () => {
      const b = await traiterFileEmails();
      return `${b.envoye} envoyé(s), ${b.nouvelle_tentative} à retenter, ${b.echec} en échec`;
    },
  },
  {
    nom: "purge-technique",
    intervalleMinutes: JOUR,
    executer: async () => {
      const [taches] = await db().delete(tacheExecution).where(lt(tacheExecution.debutLe, ilYa(30)));
      const [demarrages] = await db().delete(demarrageServeur).where(lt(demarrageServeur.demarreLe, ilYa(90)));
      const [tests] = await db()
        .delete(emailSortant)
        .where(and(eq(emailSortant.type, "test"), lt(emailSortant.creeLe, ilYa(30))));
      return `${taches.affectedRows} exécution(s), ${demarrages.affectedRows} démarrage(s), ${tests.affectedRows} e-mail(s) de test supprimés`;
    },
  },
];

export type BilanTache = { tache: string; statut: "ok" | "echec" | "pas_due"; detail?: string };
export type BilanPassage = { statut: "termine" | "deja_en_cours"; taches: BilanTache[] };

async function estDue(tache: Tache): Promise<boolean> {
  if (tache.intervalleMinutes === 0) return true;
  const [derniere] = await db()
    .select({ debutLe: tacheExecution.debutLe })
    .from(tacheExecution)
    .where(and(eq(tacheExecution.tache, tache.nom), eq(tacheExecution.statut, "ok")))
    .orderBy(desc(tacheExecution.debutLe))
    .limit(1);
  // Marge d’une minute : un cron toutes les 15 min retombe bien sur l’intervalle.
  return !derniere || Date.now() - derniere.debutLe.getTime() >= (tache.intervalleMinutes - 1) * 60_000;
}

async function executerUne(tache: Tache, declencheur: Declencheur): Promise<BilanTache> {
  if (!(await estDue(tache))) return { tache: tache.nom, statut: "pas_due" };
  const [debut] = await db().insert(tacheExecution).values({ tache: tache.nom, declencheur });
  const id = debut.insertId;
  try {
    const detail = (await tache.executer()).slice(0, 500);
    await db().update(tacheExecution).set({ statut: "ok", finLe: sql`CURRENT_TIMESTAMP(3)`, detail }).where(eq(tacheExecution.id, id));
    return { tache: tache.nom, statut: "ok", detail };
  } catch (e) {
    const detail = codeErreur(e);
    await db().update(tacheExecution).set({ statut: "echec", finLe: sql`CURRENT_TIMESTAMP(3)`, detail }).where(eq(tacheExecution.id, id));
    journal.erreur("échec de tâche", { tache: tache.nom, declencheur, erreur: detail });
    return { tache: tache.nom, statut: "echec", detail };
  }
}

export async function executerTachesDues(declencheur: Declencheur): Promise<BilanPassage> {
  const bilan = await avecVerrou("hpf_taches", 0, async () => {
    const taches: BilanTache[] = [];
    for (const tache of TACHES) taches.push(await executerUne(tache, declencheur));
    return taches;
  });
  if (bilan === null) return { statut: "deja_en_cours", taches: [] };
  journal.info("tâches exécutées", {
    declencheur,
    ok: bilan.filter((t) => t.statut === "ok").length,
    echecs: bilan.filter((t) => t.statut === "echec").length,
  });
  return { statut: "termine", taches: bilan };
}
