// Demandes des formulaires (docs/modele-donnees.md §3) et limites de débit de
// l’anti-spam (§4). Aucune adresse IP n’est stockée : les limites portent sur des
// empreintes HMAC à sel quotidien (lib/demandes/antispam.ts).

import {
  bigint,
  boolean,
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from "drizzle-orm/mysql-core";
import { TYPES_DEMANDE } from "../../demandes/schema";
import { documentJson, horodatage, identifiant, maintenant } from "./colonnes";

export const STATUTS_DEMANDE = [
  "nouvelle",
  "contactee",
  "devis_envoye",
  "acompte_recu",
  "en_preparation",
  "livree",
  "perdue",
] as const;
export const MODES_ENVOI = ["js", "sans_js"] as const;

export const demande = mysqlTable(
  "demande",
  {
    id: identifiant(),
    reference: char("reference", { length: 16 }).notNull().unique("demande_reference"),
    type: mysqlEnum("type", TYPES_DEMANDE).notNull(),
    statut: mysqlEnum("statut", STATUTS_DEMANDE).notNull().default("nouvelle"),
    nom: varchar("nom", { length: 100 }).notNull(),
    whatsappE164: varchar("whatsapp_e164", { length: 16 }).notNull(),
    /** Réponses du formulaire, validées par Zod (lib/demandes/schema.ts). */
    reponses: documentJson("reponses").notNull(),
    /** Message WhatsApp proposé au visiteur, avec la référence. */
    message: text("message").notNull(),
    consentementContactLe: horodatage("consentement_contact_le").notNull(),
    consentementVersion: varchar("consentement_version", { length: 20 }).notNull(),
    annonces: boolean("annonces").notNull().default(false),
    sourceCode: varchar("source_code", { length: 32 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    referentDomaine: varchar("referent_domaine", { length: 253 }),
    modeEnvoi: mysqlEnum("mode_envoi", MODES_ENVOI).notNull(),
    /** Clé tirée par le navigateur : un nouvel essai du même envoi renvoie la même demande. */
    cleEnvoi: varchar("cle_envoi", { length: 40 }).unique("demande_cle_envoi"),
    statutChangeLe: horodatage("statut_change_le").notNull().default(maintenant),
    creeLe: horodatage("cree_le").notNull().default(maintenant),
    majLe: horodatage("maj_le").notNull().default(maintenant),
  },
  (t) => [
    index("demande_statut").on(t.statut),
    index("demande_type").on(t.type),
    index("demande_cree").on(t.creeLe),
    index("demande_whatsapp").on(t.whatsappE164),
    index("demande_source").on(t.sourceCode),
    index("demande_maj").on(t.majLe),
  ],
);

export const TYPES_EVENEMENT_DEMANDE = ["creation", "statut", "note", "contact_whatsapp", "correction"] as const;

/** Historique d’une demande : création, statuts et notes internes (phase 5). */
export const demandeEvenement = mysqlTable(
  "demande_evenement",
  {
    id: identifiant(),
    demandeId: bigint("demande_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => demande.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", TYPES_EVENEMENT_DEMANDE).notNull(),
    deStatut: mysqlEnum("de_statut", STATUTS_DEMANDE),
    versStatut: mysqlEnum("vers_statut", STATUTS_DEMANDE),
    texte: text("texte"),
    /** Compte du back-office (phase 5) ; nul pour le système. */
    utilisateurId: varchar("utilisateur_id", { length: 64 }),
    creeLe: horodatage("cree_le").notNull().default(maintenant),
  },
  (t) => [index("demande_evenement_demande").on(t.demandeId, t.creeLe)],
);

/** Compteurs de l’anti-spam par fenêtre de temps ; purgés chaque jour. */
export const limiteDebit = mysqlTable(
  "limite_debit",
  {
    /** « ip:<empreinte> », « tel:<empreinte> » : jamais la valeur en clair. */
    cle: varchar("cle", { length: 64 }).notNull(),
    fenetreDebut: horodatage("fenetre_debut").notNull(),
    compteur: int("compteur", { unsigned: true }).notNull().default(0),
  },
  (t) => [primaryKey({ name: "limite_debit_pk", columns: [t.cle, t.fenetreDebut] }), index("limite_debit_fenetre").on(t.fenetreDebut)],
);
