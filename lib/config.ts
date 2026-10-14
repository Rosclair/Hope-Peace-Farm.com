// Lecture et validation des variables d’environnement (modèle : .env.example).
// Chaque domaine (base, SMTP, téléversements, secrets) est validé à part : une
// variable manquante pour l’e-mail n’empêche pas la page publique de s’afficher.
// Les erreurs ne citent que des noms de variables, jamais leurs valeurs.

import { createHmac } from "node:crypto";
import path from "node:path";
import { z } from "zod";

/** Une chaîne vide dans .env vaut « absente » (la valeur par défaut s’applique). */
const sansVide = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const texte = z.preprocess(sansVide, z.string().trim().min(1));
const booleen = (defaut: boolean) =>
  z.preprocess(sansVide, z.enum(["0", "1", "true", "false"]).optional()).transform((v) =>
    v === undefined ? defaut : v === "1" || v === "true",
  );
const port = (defaut: number) => z.preprocess(sansVide, z.coerce.number().int().min(1).max(65535).default(defaut));
const secret = z.preprocess(sansVide, z.string().min(32, "32 caractères au moins"));

export class ConfigurationIncomplete extends Error {
  constructor(
    readonly domaine: string,
    readonly variables: string[],
  ) {
    super(`Configuration « ${domaine} » incomplète ou invalide : ${variables.join(", ")}`);
    this.name = "ConfigurationIncomplete";
  }
}

function lire<S extends z.ZodType>(domaine: string, schema: S, source: NodeJS.ProcessEnv): z.output<S> {
  const resultat = schema.safeParse(source);
  if (resultat.success) return resultat.data;
  const noms = [...new Set(resultat.error.issues.map((i) => String(i.path[0] ?? "?")))].sort();
  throw new ConfigurationIncomplete(domaine, noms);
}

const schemaSite = z.object({
  SITE_URL: z.preprocess(sansVide, z.url().default("http://localhost:3000")),
  SITE_INDEXABLE: booleen(false),
});

const schemaBase = z.object({
  DB_HOST: texte,
  DB_PORT: port(3306),
  DB_NAME: texte,
  DB_USER: texte,
  DB_PASSWORD: z.string(),
});

const schemaSmtp = z
  .object({
    SMTP_HOST: texte,
    SMTP_PORT: port(465),
    SMTP_SECURE: z.preprocess(sansVide, z.enum(["0", "1", "true", "false"]).optional()),
    SMTP_USER: texte,
    SMTP_PASSWORD: texte,
    MAIL_FROM: z.preprocess(sansVide, z.string().trim().optional()),
    NOTIFICATION_EMAIL: z.preprocess(sansVide, z.email()),
  })
  .transform((c) => ({
    hote: c.SMTP_HOST,
    port: c.SMTP_PORT,
    // 465 : TLS dès la connexion ; 587 : STARTTLS (secure = false).
    securise: c.SMTP_SECURE === undefined ? c.SMTP_PORT === 465 : c.SMTP_SECURE === "1" || c.SMTP_SECURE === "true",
    utilisateur: c.SMTP_USER,
    motDePasse: c.SMTP_PASSWORD,
    expediteur: c.MAIL_FROM ?? `"Hope & Peace Farm" <${c.SMTP_USER}>`,
    notification: c.NOTIFICATION_EMAIL,
  }));

const schemaSecrets = z.object({
  CRON_SECRET: secret,
  DIAGNOSTIC_SECRET: secret,
});

const schemaTaches = z.object({
  TACHES_MINUTEUR_MINUTES: z.preprocess(sansVide, z.coerce.number().int().min(0).max(1440).default(0)),
});

const schemaDemandes = z.object({
  /** Secret des empreintes d’IP et des liens de confirmation ; sinon dérivé de CRON_SECRET. */
  DEMANDES_SECRET: z.preprocess(sansVide, z.string().min(32, "32 caractères au moins").optional()),
  /** En-tête qui porte l’adresse du visiteur, et nombre de proxys de confiance devant le serveur. */
  IP_ENTETE: z.preprocess(sansVide, z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).default("x-forwarded-for")),
  IP_PROXYS: z.preprocess(sansVide, z.coerce.number().int().min(0).max(5).default(1)),
  /** Durée de conservation des demandes, en mois après leur dernière mise à jour. */
  DEMANDES_CONSERVATION_MOIS: z.preprocess(sansVide, z.coerce.number().int().min(1).max(120).default(12)),
});

const schemaAuth = z.object({
  /** Clé de Better Auth : signe les cookies et chiffre les secrets TOTP. Ne jamais la changer après la mise en service. */
  AUTH_SECRET: secret,
});

export function configSite(source = process.env) {
  return lire("site", schemaSite, source);
}

export function configBase(source = process.env) {
  return lire("base", schemaBase, source);
}

export function configSmtp(source = process.env) {
  return lire("smtp", schemaSmtp, source);
}

export function configSecrets(source = process.env) {
  return lire("secrets", schemaSecrets, source);
}

export function configAuth(source = process.env) {
  return lire("auth", schemaAuth, source);
}

export function configTaches(source = process.env) {
  return lire("taches", schemaTaches, source);
}

export function configDemandes(source = process.env) {
  const c = lire("demandes", schemaDemandes, source);
  return {
    entete: c.IP_ENTETE,
    proxys: c.IP_PROXYS,
    conservationMois: c.DEMANDES_CONSERVATION_MOIS,
    /**
     * Secret propre aux demandes. Sans DEMANDES_SECRET, il est dérivé de CRON_SECRET
     * (HMAC à étiquette distincte) : un déploiement sans la nouvelle variable continue
     * de recevoir les demandes.
     */
    secret: () => {
      if (c.DEMANDES_SECRET) return c.DEMANDES_SECRET;
      const { CRON_SECRET } = configSecrets(source);
      return createHmac("sha256", CRON_SECRET).update("hpf-demandes").digest("base64url");
    },
  };
}

/**
 * Dossier des fichiers téléversés. En production, chemin absolu obligatoire et
 * situé hors du dossier de déploiement (Hostinger efface `hbuilds/` à chaque
 * déploiement). En développement : `uploads/` à la racine du projet.
 */
export function dossierTeleversement(source = process.env, production = source.NODE_ENV === "production"): string {
  const brut = sansVide(source.UPLOAD_DIR);
  if (typeof brut !== "string") {
    if (production) throw new ConfigurationIncomplete("televersement", ["UPLOAD_DIR"]);
    return path.resolve(process.cwd(), "uploads");
  }
  if (!path.isAbsolute(brut)) throw new ConfigurationIncomplete("televersement", ["UPLOAD_DIR"]);
  return path.resolve(brut);
}

/** Domaines de configuration et variables attendues, pour le diagnostic. */
export const VARIABLES_ATTENDUES = {
  site: ["SITE_URL", "SITE_INDEXABLE"],
  base: ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"],
  smtp: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "NOTIFICATION_EMAIL"],
  televersement: ["UPLOAD_DIR"],
  secrets: ["CRON_SECRET", "DIAGNOSTIC_SECRET"],
  auth: ["AUTH_SECRET"],
  taches: ["TACHES_MINUTEUR_MINUTES"],
  demandes: ["DEMANDES_SECRET", "IP_ENTETE", "IP_PROXYS", "DEMANDES_CONSERVATION_MOIS"],
} as const;
