// Contenu de la page (docs/modele-donnees.md §1) : un brouillon unique, des versions
// publiées immuables et l’état de publication (quelle version est en ligne).
// Publier et revenir en arrière sont des copies atomiques de documents JSON validés.

import { char, int, mysqlTable, tinyint, varchar } from "drizzle-orm/mysql-core";
import { documentJson, horodatage, identifiant, maintenant } from "./colonnes";

/** Brouillon unique (id = 1), modifié champ par champ depuis le back-office (phase 5). */
export const contenuBrouillon = mysqlTable("contenu_brouillon", {
  id: tinyint("id", { unsigned: true }).primaryKey(),
  donnees: documentJson("donnees").notNull(),
  /** Chemins des champs marqués « à confirmer » (ex. « prix.vivant »). */
  aConfirmer: documentJson("a_confirmer").notNull(),
  /** Incrémentée à chaque enregistrement : empêche d’écraser la saisie d’un autre (verrou optimiste). */
  revision: int("revision", { unsigned: true }).notNull().default(1),
  modifieLe: horodatage("modifie_le").notNull().default(maintenant),
  /** Auteur lisible : « initialisation », « ligne de commande », puis le compte (phase 5). */
  modifiePar: varchar("modifie_par", { length: 120 }).notNull(),
});

/** Versions publiées, jamais modifiées : historique et retour arrière. */
export const versionContenu = mysqlTable("version_contenu", {
  id: identifiant(),
  numero: int("numero", { unsigned: true }).notNull().unique("version_contenu_numero"),
  donnees: documentJson("donnees").notNull(),
  aConfirmer: documentJson("a_confirmer").notNull(),
  /** SHA-256 du document en JSON canonique (clés triées) : repère les publications identiques. */
  empreinte: char("empreinte", { length: 64 }).notNull(),
  publieLe: horodatage("publie_le").notNull().default(maintenant),
  publiePar: varchar("publie_par", { length: 120 }).notNull(),
  /** Numéro de la version republiée lors d’un retour arrière. */
  restaureeDepuis: int("restauree_depuis", { unsigned: true }),
  note: varchar("note", { length: 200 }),
});

/** Ligne unique (id = 1) : numéro de la version en ligne. */
export const etatPublication = mysqlTable("etat_publication", {
  id: tinyint("id", { unsigned: true }).primaryKey(),
  versionEnLigne: int("version_en_ligne", { unsigned: true }).notNull(),
  modifieLe: horodatage("modifie_le").notNull().default(maintenant),
});
