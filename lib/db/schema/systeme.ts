// Tables techniques de la phase 1 : file d’envoi des e-mails, exécutions des
// tâches planifiées, démarrages du serveur. Dates en UTC (session forcée à
// +00:00 dans client.ts), précision à la milliseconde.

import { index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { horodatage, identifiant, maintenant } from "./colonnes";

export const TYPES_EMAIL = ["nouvelle_demande", "alerte_securite", "invitation", "test"] as const;
export const STATUTS_EMAIL = ["en_attente", "envoye", "echec"] as const;

/** File d’envoi : chaque e-mail est écrit ici avant d’être envoyé (architecture §7). */
export const emailSortant = mysqlTable(
  "email_sortant",
  {
    id: identifiant(),
    type: mysqlEnum("type", TYPES_EMAIL).notNull(),
    destinataire: varchar("destinataire", { length: 254 }).notNull(),
    sujet: varchar("sujet", { length: 200 }).notNull(),
    texte: text("texte").notNull(),
    html: text("html"),
    statut: mysqlEnum("statut", STATUTS_EMAIL).notNull().default("en_attente"),
    tentatives: int("tentatives", { unsigned: true }).notNull().default(0),
    prochaineTentativeLe: horodatage("prochaine_tentative_le").notNull().default(maintenant),
    /** Code d’erreur SMTP ou réseau seulement, jamais le message complet. */
    derniereErreur: varchar("derniere_erreur", { length: 200 }),
    creeLe: horodatage("cree_le").notNull().default(maintenant),
    envoyeLe: horodatage("envoye_le"),
  },
  (t) => [index("email_sortant_statut_prochaine").on(t.statut, t.prochaineTentativeLe)],
);

export const DECLENCHEURS_TACHE = ["cron", "minuteur", "manuel"] as const;
export const STATUTS_TACHE = ["en_cours", "ok", "echec"] as const;

/** Une ligne par tâche exécutée : sert au contrôle du cron et au tableau de bord. */
export const tacheExecution = mysqlTable(
  "tache_execution",
  {
    id: identifiant(),
    tache: varchar("tache", { length: 40 }).notNull(),
    declencheur: mysqlEnum("declencheur", DECLENCHEURS_TACHE).notNull(),
    statut: mysqlEnum("statut", STATUTS_TACHE).notNull().default("en_cours"),
    debutLe: horodatage("debut_le").notNull().default(maintenant),
    finLe: horodatage("fin_le"),
    /** Résumé chiffré (« 2 envoyés ») ou code d’erreur, sans donnée personnelle. */
    detail: varchar("detail", { length: 500 }),
  },
  (t) => [index("tache_execution_tache_debut").on(t.tache, t.debutLe)],
);

/** Démarrages du processus Node : révèle les déploiements et les mises en veille. */
export const demarrageServeur = mysqlTable(
  "demarrage_serveur",
  {
    id: identifiant(),
    build: varchar("build", { length: 64 }).notNull(),
    versionNode: varchar("version_node", { length: 20 }).notNull(),
    demarreLe: horodatage("demarre_le").notNull().default(maintenant),
  },
  (t) => [index("demarrage_serveur_demarre").on(t.demarreLe)],
);
