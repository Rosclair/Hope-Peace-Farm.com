// Comptes du back-office (docs/modele-donnees.md §6), tables utilisées par Better Auth
// (lib/auth/serveur.ts) : les clés JavaScript sont celles qu’attend Better Auth, les
// colonnes portent des noms français. Aucune adresse IP en clair : la session garde
// une empreinte HMAC (colonne `empreinte_ip`) et un résumé de l’appareil (« Chrome ·
// Android ») à la place de l’agent du navigateur.

import { boolean, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { horodatage, maintenant } from "./colonnes";

export const ROLES = ["proprietaire", "equipe"] as const;
export type Role = (typeof ROLES)[number];

const id = () => varchar("id", { length: 64 }).primaryKey();
const refUtilisateur = (nom: string) =>
  varchar(nom, { length: 64 })
    .notNull()
    .references(() => utilisateur.id, { onDelete: "cascade" });

export const utilisateur = mysqlTable("utilisateur", {
  id: id(),
  name: varchar("nom", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique("utilisateur_email"),
  emailVerified: boolean("email_verifie").notNull().default(false),
  image: varchar("image", { length: 500 }),
  role: mysqlEnum("role", ROLES).notNull().default("equipe"),
  actif: boolean("actif").notNull().default(true),
  twoFactorEnabled: boolean("deux_facteurs_active").notNull().default(false),
  /** Échecs consécutifs (mot de passe ou code) ; remis à zéro à la connexion réussie. */
  echecsConnexion: int("echecs_connexion", { unsigned: true }).notNull().default(0),
  verrouilleJusqua: horodatage("verrouille_jusqua"),
  createdAt: horodatage("cree_le").notNull().default(maintenant),
  updatedAt: horodatage("maj_le").notNull().default(maintenant),
});

export const session = mysqlTable(
  "session",
  {
    id: id(),
    token: varchar("jeton", { length: 128 }).notNull().unique("session_jeton"),
    userId: refUtilisateur("utilisateur_id"),
    expiresAt: horodatage("expire_le").notNull(),
    /** Empreinte HMAC de l’adresse (lib/auth/serveur.ts), jamais l’adresse. */
    ipAddress: varchar("empreinte_ip", { length: 64 }),
    /** Résumé de l’appareil (« Chrome · Android »), jamais l’agent complet. */
    userAgent: varchar("appareil", { length: 80 }),
    createdAt: horodatage("cree_le").notNull().default(maintenant),
    updatedAt: horodatage("maj_le").notNull().default(maintenant),
  },
  (t) => [index("session_utilisateur").on(t.userId)],
);

/** Fournisseur « identifiants » : mot de passe haché (scrypt). */
export const compte = mysqlTable(
  "compte",
  {
    id: id(),
    accountId: varchar("compte_id", { length: 254 }).notNull(),
    providerId: varchar("fournisseur", { length: 40 }).notNull(),
    userId: refUtilisateur("utilisateur_id"),
    accessToken: text("jeton_acces"),
    refreshToken: text("jeton_rafraichissement"),
    idToken: text("jeton_identite"),
    accessTokenExpiresAt: horodatage("jeton_acces_expire_le"),
    refreshTokenExpiresAt: horodatage("jeton_rafraichissement_expire_le"),
    scope: varchar("portee", { length: 500 }),
    password: varchar("mot_de_passe", { length: 255 }),
    createdAt: horodatage("cree_le").notNull().default(maintenant),
    updatedAt: horodatage("maj_le").notNull().default(maintenant),
  },
  (t) => [index("compte_utilisateur").on(t.userId)],
);

/** Jetons temporaires de Better Auth (défi du second facteur, essais). */
export const verification = mysqlTable(
  "verification",
  {
    id: id(),
    identifier: varchar("identifiant", { length: 255 }).notNull(),
    value: text("valeur").notNull(),
    expiresAt: horodatage("expire_le").notNull(),
    createdAt: horodatage("cree_le").notNull().default(maintenant),
    updatedAt: horodatage("maj_le").notNull().default(maintenant),
  },
  (t) => [index("verification_identifiant").on(t.identifier)],
);

/** Secret TOTP et 10 codes de secours, chiffrés par Better Auth. */
export const deuxFacteurs = mysqlTable(
  "deux_facteurs",
  {
    id: id(),
    secret: varchar("secret", { length: 255 }).notNull(),
    backupCodes: text("codes_secours").notNull(),
    userId: refUtilisateur("utilisateur_id"),
    verified: boolean("verifie").notNull().default(true),
    failedVerificationCount: int("echecs", { unsigned: true }).notNull().default(0),
    lockedUntil: horodatage("verrouille_jusqua"),
  },
  (t) => [index("deux_facteurs_utilisateur").on(t.userId), index("deux_facteurs_secret").on(t.secret)],
);

/** Invitation d’un membre : seule l’empreinte du jeton est gardée. */
export const invitation = mysqlTable("invitation", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 254 }).notNull(),
  nom: varchar("nom", { length: 100 }).notNull(),
  role: mysqlEnum("role", ROLES).notNull().default("equipe"),
  jetonEmpreinte: varchar("jeton_empreinte", { length: 64 }).notNull().unique("invitation_jeton"),
  expireLe: horodatage("expire_le").notNull(),
  creePar: varchar("cree_par", { length: 64 }).notNull(),
  accepteeLe: horodatage("acceptee_le"),
  creeLe: horodatage("cree_le").notNull().default(maintenant),
});
