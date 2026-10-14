// Validation serveur d’une demande (brief §3, docs/modele-donnees.md §3). Tout ce
// qu’envoie le navigateur est revalidé ici, qu’il vienne du moteur (JSON) ou d’un
// formulaire envoyé sans JavaScript : mêmes noms de champs que le balisage, mêmes
// bornes que les attributs maxlength, mêmes règles que lib/moteur/demande.ts.
// Les erreurs sont rendues par nom de champ (page de confirmation sans JavaScript).

import { z } from "zod";
import { normaliserNumero } from "./numero";

z.config(z.locales.fr());

export const TYPES_DEMANDE = ["ceremonie", "poulets", "pro"] as const;
export type TypeDemande = (typeof TYPES_DEMANDE)[number];

/** Texte exact de la case de consentement, enregistré avec sa version. */
export const TEXTE_CONSENTEMENT = "J’accepte d’être contacté sur WhatsApp au sujet de ma demande.";
export const VERSION_CONSENTEMENT = "2026-10-14";

/** Caractères de contrôle refusés (sauf retours à la ligne et tabulations des précisions). */
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const texte = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((t) => !CONTROLE.test(t), "Caractère non permis.");
const requis = (max: number) => texte(max).min(1, "Champ obligatoire.");
const facultatif = (max: number) => texte(max).optional().default("");
const coche = z
  .union([z.literal("1"), z.literal("on"), z.literal(true), z.literal(""), z.literal(false)])
  .optional()
  .transform((v) => v === "1" || v === "on" || v === true);

/** Date AAAA-MM-JJ à Douala (UTC+1, sans heure d’été), décalée de `jours`. */
export const isoDouala = (jours = 0, maintenant = Date.now()) =>
  new Date(maintenant + 36e5 + jours * 864e5).toISOString().slice(0, 10);

/**
 * Date d’un événement : d’aujourd’hui à dans douze mois (comme le navigateur), avec
 * un jour de tolérance en arrière pour un formulaire ouvert avant minuit.
 */
const dateFuture = () =>
  z.iso.date("Date attendue.").refine((d) => d >= isoDouala(-1) && d <= isoDouala(366), "Date hors des douze prochains mois.");

/** Champs communs à la dernière étape des trois formulaires. */
const commun = {
  whatsapp: z
    .string()
    .max(40)
    .transform((v, ctx) => {
      const n = normaliserNumero(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Numéro WhatsApp invalide." });
        return z.NEVER;
      }
      return n;
    }),
  consentement: coche.refine((v) => v, "Accord obligatoire."),
  annonces: coche,
  precisions: facultatif(300),
};

export const schemaCeremonie = z
  .object({
    ceremonie: z.enum(["funerailles", "mariage", "dot", "bapteme", "retour", "autre"]),
    date: z.string().optional().default(""),
    date_inconnue: coche,
    lieu: requis(140),
    invites: z.enum(["moins de 100", "100 à 200", "200 à 400", "plus de 400"]),
    nom: requis(80),
    residence: requis(80),
    ...commun,
  })
  .superRefine((d, ctx) => {
    if (d.date_inconnue) return;
    const r = dateFuture().safeParse(d.date);
    if (!r.success) ctx.addIssue({ code: "custom", path: ["date"], message: r.error.issues[0]?.message ?? "Date attendue." });
  })
  .transform((d) => (d.date_inconnue ? { ...d, date: "" } : d));

export const schemaPoulets = z
  .object({
    nombre: z.string().trim().regex(/^[1-9][0-9]{0,3}$/, "Nombre de 1 à 9999."),
    preparation: z.enum(["vivant", "pret", "sauce", "braise"]),
    date: dateFuture(),
    reception: z.enum(["retrait", "livraison"]),
    lieu: facultatif(120),
    nom: requis(80),
    ...commun,
  })
  .superRefine((d, ctx) => {
    if (d.reception === "livraison" && !d.lieu) ctx.addIssue({ code: "custom", path: ["lieu"], message: "Champ obligatoire." });
  })
  .transform((d) => (d.reception === "livraison" ? d : { ...d, lieu: "" }));

export const schemaPro = z.object({
  etablissement: requis(100),
  type: z.enum(["restaurant", "snack ou braiseur", "hôtel", "traiteur", "cantine ou internat", "autre"]),
  ville: requis(80),
  volume: z.enum(["moins de 10", "10 à 30", "30 à 60", "plus de 60"]),
  preparation: z.enum(["vivants", "prêts à cuire", "découpés"]),
  contact: requis(80),
  ...commun,
});

export const SCHEMAS = { ceremonie: schemaCeremonie, poulets: schemaPoulets, pro: schemaPro } as const;
export type DemandeValidee =
  | { type: "ceremonie"; donnees: z.output<typeof schemaCeremonie> }
  | { type: "poulets"; donnees: z.output<typeof schemaPoulets> }
  | { type: "pro"; donnees: z.output<typeof schemaPro> };

/** Champs techniques envoyés avec la demande (hors réponses). */
export const schemaEnvoi = z.object({
  formulaire: z.enum(TYPES_DEMANDE),
  /** Champ piège, invisible : rempli ⇒ robot. */
  site_web: z.string().max(500).optional().default(""),
  /** Millisecondes entre la préparation du formulaire et l’envoi (moteur seulement). */
  duree: z.coerce.number().int().min(0).max(864e5).optional(),
  /** Clé d’envoi tirée par le navigateur : « Réessayer » ne crée pas de doublon. */
  cle: z
    .string()
    .regex(/^[A-Za-z0-9-]{16,40}$/)
    .optional(),
  /** Source de la visite (lien de campagne ?src=, utm_*, domaine d’origine). */
  src: z.string().trim().max(32).regex(/^[a-z0-9-]*$/).optional().catch(undefined),
  utm_source: z.string().trim().max(100).optional().catch(undefined),
  utm_medium: z.string().trim().max(100).optional().catch(undefined),
  utm_campaign: z.string().trim().max(100).optional().catch(undefined),
  referent: z.string().trim().max(253).regex(/^[a-z0-9.-]*$/i).optional().catch(undefined),
});
export type Envoi = z.output<typeof schemaEnvoi>;

export type ResultatValidation =
  | { ok: true; demande: DemandeValidee; envoi: Envoi }
  | { ok: false; champs: string[] };

/** Valide un envoi brut (objet JSON ou champs d’un formulaire). */
export function validerDemande(brut: Record<string, unknown>): ResultatValidation {
  const envoi = schemaEnvoi.safeParse(brut);
  if (!envoi.success) return { ok: false, champs: ["formulaire"] };
  const type = envoi.data.formulaire;
  const r = SCHEMAS[type].safeParse(brut);
  if (!r.success) {
    const champs = [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "formulaire")))];
    return { ok: false, champs };
  }
  return { ok: true, demande: { type, donnees: r.data } as DemandeValidee, envoi: envoi.data };
}
