// Journal d’audit (docs/modele-donnees.md §9) et réglages hors publication (§2).
// Le journal dit qui a changé quoi et quand, avec l’avant et l’après ; les valeurs
// sensibles y sont masquées (lib/audit.ts) et aucune donnée d’un client n’y figure.

import { index, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { documentJson, horodatage, identifiant, maintenant } from "./colonnes";

export const journalAudit = mysqlTable(
  "journal_audit",
  {
    id: identifiant(),
    le: horodatage("le").notNull().default(maintenant),
    /** Compte du back-office ; nul pour le système ou une tentative sans compte connu. */
    utilisateurId: varchar("utilisateur_id", { length: 64 }),
    /** Ex. « contenu.modifier », « demande.statut », « connexion.echec ». */
    action: varchar("action", { length: 60 }).notNull(),
    cibleType: varchar("cible_type", { length: 40 }),
    cibleId: varchar("cible_id", { length: 120 }),
    avant: documentJson("avant"),
    apres: documentJson("apres"),
    empreinteIp: varchar("empreinte_ip", { length: 64 }),
  },
  (t) => [index("journal_audit_le").on(t.le), index("journal_audit_utilisateur").on(t.utilisateurId, t.le), index("journal_audit_action").on(t.action, t.le)],
);

/** Réglages modifiables dans le back-office, hors du contenu publié. */
export const reglage = mysqlTable("reglage", {
  cle: varchar("cle", { length: 60 }).primaryKey(),
  valeur: documentJson("valeur").notNull(),
  modifieLe: horodatage("modifie_le").notNull().default(maintenant),
  modifiePar: varchar("modifie_par", { length: 64 }),
});
