// Demandes dans le back-office (brief §4.3) : liste filtrable, fiche, statuts avec
// historique, notes internes, correction, export CSV, suppression des données d’un
// client à sa demande. Le journal d’audit ne reçoit jamais la donnée d’un client :
// la référence, les statuts, et pour une note ou une correction seulement le fait.

import "server-only";
import { and, count, desc, eq, gte, inArray, like, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demande, demandeEvenement, emailSortant, STATUTS_DEMANDE, utilisateur } from "@/lib/db/schema";
import { dateLongue } from "@/lib/contenu/format";
import { normaliserNumero } from "@/lib/demandes/numero";
import { TYPES_DEMANDE } from "@/lib/demandes/schema";
import { versCsv } from "./csv";

export type Statut = (typeof STATUTS_DEMANDE)[number];

export const LIBELLES_STATUT: Record<Statut, string> = {
  nouvelle: "Nouvelle",
  contactee: "Contactée",
  devis_envoye: "Devis envoyé",
  acompte_recu: "Acompte reçu",
  en_preparation: "En préparation",
  livree: "Livrée",
  perdue: "Perdue",
};

export const LIBELLES_TYPE: Record<(typeof TYPES_DEMANDE)[number], string> = {
  ceremonie: "Cérémonie",
  poulets: "Poulets",
  pro: "Pro",
};

/** Statuts clos : jamais « à relancer ». */
export const STATUTS_CLOS: Statut[] = ["livree", "perdue"];
export const RELANCE_HEURES = 24;
export const PAR_PAGE = 25;

const vide = (v: unknown) => (v === "" || v === null ? undefined : v);
export const schemaFiltres = z.object({
  statut: z.preprocess(vide, z.enum([...STATUTS_DEMANDE, "a_relancer"]).optional()).catch(undefined),
  type: z.preprocess(vide, z.enum(TYPES_DEMANDE).optional()).catch(undefined),
  source: z.preprocess(vide, z.string().trim().max(100).optional()).catch(undefined),
  du: z.preprocess(vide, z.iso.date().optional()).catch(undefined),
  au: z.preprocess(vide, z.iso.date().optional()).catch(undefined),
  q: z.preprocess(vide, z.string().trim().max(100).optional()).catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type Filtres = z.output<typeof schemaFiltres>;

/** Jour de Douala (UTC+1) → début de ce jour en UTC. */
const debutJour = (iso: string) => new Date(`${iso}T00:00:00+01:00`);

function conditions(f: Filtres): SQL | undefined {
  const c: SQL[] = [];
  if (f.statut === "a_relancer") {
    c.push(notInArray(demande.statut, STATUTS_CLOS));
    c.push(lt(demande.statutChangeLe, new Date(Date.now() - RELANCE_HEURES * 36e5)));
  } else if (f.statut) c.push(eq(demande.statut, f.statut));
  if (f.type) c.push(eq(demande.type, f.type));
  if (f.source) {
    const s = f.source;
    if (s === "directe") c.push(sql`${demande.sourceCode} IS NULL AND ${demande.utmSource} IS NULL AND ${demande.referentDomaine} IS NULL`);
    else c.push(or(eq(demande.sourceCode, s), eq(demande.utmSource, s), eq(demande.referentDomaine, s))!);
  }
  if (f.du) c.push(gte(demande.creeLe, debutJour(f.du)));
  if (f.au) c.push(lt(demande.creeLe, new Date(debutJour(f.au).getTime() + 864e5)));
  if (f.q) {
    const motif = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const numero = normaliserNumero(f.q);
    c.push(or(like(demande.reference, motif), like(demande.nom, motif), ...(numero ? [eq(demande.whatsappE164, numero)] : []))!);
  }
  return c.length ? and(...c) : undefined;
}

/** Source lisible d’une demande : code de campagne, sinon utm_source, sinon site d’origine. */
export function sourceDe(d: { sourceCode: string | null; utmSource: string | null; referentDomaine: string | null }): string {
  return d.sourceCode ?? d.utmSource ?? d.referentDomaine ?? "directe";
}

const colonnesListe = {
  id: demande.id,
  reference: demande.reference,
  type: demande.type,
  statut: demande.statut,
  nom: demande.nom,
  whatsappE164: demande.whatsappE164,
  sourceCode: demande.sourceCode,
  utmSource: demande.utmSource,
  referentDomaine: demande.referentDomaine,
  statutChangeLe: demande.statutChangeLe,
  creeLe: demande.creeLe,
};

export async function listerDemandes(f: Filtres) {
  const ou = conditions(f);
  const [total] = await db().select({ n: count() }).from(demande).where(ou);
  const lignes = await db()
    .select(colonnesListe)
    .from(demande)
    .where(ou)
    .orderBy(desc(demande.creeLe), desc(demande.id))
    .limit(PAR_PAGE)
    .offset((f.page - 1) * PAR_PAGE);
  return { lignes, total: total?.n ?? 0 };
}

/** Sources rencontrées (pour le filtre). */
export async function sourcesConnues(): Promise<string[]> {
  const lignes = await db()
    .selectDistinct({ s: sql<string>`COALESCE(${demande.sourceCode}, ${demande.utmSource}, ${demande.referentDomaine}, 'directe')` })
    .from(demande)
    .limit(100);
  return lignes.map((l) => l.s).sort((a, b) => a.localeCompare(b, "fr"));
}

export function estARelancer(d: { statut: Statut; statutChangeLe: Date }, maintenant = Date.now()): boolean {
  return !STATUTS_CLOS.includes(d.statut) && maintenant - d.statutChangeLe.getTime() > RELANCE_HEURES * 36e5;
}

export async function lireDemande(reference: string) {
  const [d] = await db().select().from(demande).where(eq(demande.reference, reference)).limit(1);
  if (!d) return null;
  const evenements = await db()
    .select({
      id: demandeEvenement.id,
      type: demandeEvenement.type,
      deStatut: demandeEvenement.deStatut,
      versStatut: demandeEvenement.versStatut,
      texte: demandeEvenement.texte,
      creeLe: demandeEvenement.creeLe,
      auteur: utilisateur.name,
    })
    .from(demandeEvenement)
    .leftJoin(utilisateur, eq(utilisateur.id, demandeEvenement.utilisateurId))
    .where(eq(demandeEvenement.demandeId, d.id))
    .orderBy(desc(demandeEvenement.creeLe), desc(demandeEvenement.id));
  return { ...d, statut: d.statut as Statut, reponses: (d.reponses ?? {}) as Record<string, unknown>, evenements };
}

export class DemandeIntrouvable extends Error {
  constructor() {
    super("Demande introuvable.");
    this.name = "DemandeIntrouvable";
  }
}

/** Change le statut (avec historique). Renvoie l’ancien statut, ou null s’il est inchangé. */
export async function changerStatut(reference: string, vers: Statut, utilisateurId: string, texte?: string): Promise<Statut | null> {
  return db().transaction(async (tx) => {
    const [d] = await tx.select({ id: demande.id, statut: demande.statut }).from(demande).where(eq(demande.reference, reference)).for("update");
    if (!d) throw new DemandeIntrouvable();
    if (d.statut === vers) return null;
    await tx
      .update(demande)
      .set({ statut: vers, statutChangeLe: sql`CURRENT_TIMESTAMP(3)`, majLe: sql`CURRENT_TIMESTAMP(3)` })
      .where(eq(demande.id, d.id));
    await tx.insert(demandeEvenement).values({ demandeId: d.id, type: "statut", deStatut: d.statut, versStatut: vers, texte: texte || null, utilisateurId });
    return d.statut as Statut;
  });
}

export async function ajouterEvenement(
  reference: string,
  type: "note" | "contact_whatsapp" | "correction",
  utilisateurId: string,
  texte: string | null,
): Promise<void> {
  await db().transaction(async (tx) => {
    const [d] = await tx.select({ id: demande.id }).from(demande).where(eq(demande.reference, reference)).for("update");
    if (!d) throw new DemandeIntrouvable();
    await tx.update(demande).set({ majLe: sql`CURRENT_TIMESTAMP(3)` }).where(eq(demande.id, d.id));
    await tx.insert(demandeEvenement).values({ demandeId: d.id, type, texte, utilisateurId });
  });
}

/** Droit de correction : nom et numéro WhatsApp (numéro normalisé). Renvoie les champs changés. */
export async function corrigerDemande(reference: string, champs: { nom: string; whatsappE164: string }, utilisateurId: string): Promise<string[]> {
  return db().transaction(async (tx) => {
    const [d] = await tx.select({ id: demande.id, nom: demande.nom, whatsappE164: demande.whatsappE164 }).from(demande).where(eq(demande.reference, reference)).for("update");
    if (!d) throw new DemandeIntrouvable();
    const changes = (["nom", "whatsappE164"] as const).filter((k) => d[k] !== champs[k]);
    if (!changes.length) return [];
    await tx.update(demande).set({ ...champs, majLe: sql`CURRENT_TIMESTAMP(3)` }).where(eq(demande.id, d.id));
    const libelles = changes.map((k) => (k === "nom" ? "nom" : "numéro WhatsApp"));
    await tx.insert(demandeEvenement).values({ demandeId: d.id, type: "correction", texte: `Correction : ${libelles.join(", ")}.`, utilisateurId });
    return changes;
  });
}

/** Demandes d’un client, par numéro WhatsApp normalisé (aperçu avant suppression). */
export async function demandesDuNumero(numeroE164: string) {
  return db()
    .select({ reference: demande.reference, type: demande.type, statut: demande.statut, creeLe: demande.creeLe })
    .from(demande)
    .where(eq(demande.whatsappE164, numeroE164))
    .orderBy(desc(demande.creeLe));
}

/**
 * Droit à l’effacement : supprime toutes les demandes d’un numéro (historique et
 * e-mails liés par cascade). Renvoie le nombre de demandes supprimées.
 */
export async function supprimerClient(numeroE164: string): Promise<number> {
  const [r] = await db().delete(demande).where(eq(demande.whatsappE164, numeroE164));
  return r.affectedRows;
}

// ---------------------------------------------------------------------------
// Export CSV

const LIBELLES_REPONSES: Record<string, string> = {
  ceremonie: "Cérémonie",
  date: "Date",
  date_inconnue: "Date inconnue",
  lieu: "Lieu",
  invites: "Invités",
  residence: "Résidence",
  nombre: "Nombre",
  preparation: "Préparation",
  reception: "Réception",
  etablissement: "Établissement",
  type: "Type d’établissement",
  ville: "Ville",
  volume: "Volume",
  contact: "Contact",
  nom: "Nom",
  precisions: "Précisions",
};

export function libelleReponse(cle: string): string {
  return LIBELLES_REPONSES[cle] ?? cle;
}

const VALEURS_REPONSES: Record<string, Record<string, string>> = {
  ceremonie: { funerailles: "funérailles", mariage: "mariage", dot: "dot", bapteme: "baptême", retour: "retour au village", autre: "autre cérémonie" },
  preparation: { vivant: "vivant", pret: "prêt à cuire", sauce: "découpé pour la sauce", braise: "découpé pour la braise" },
  reception: { retrait: "retrait à la ferme", livraison: "livraison" },
};

/** Valeur lisible d’une réponse (« pret » → « prêt à cuire », date en toutes lettres). */
export function valeurReponse(cle: string, v: unknown): string {
  if (v === true) return "oui";
  const t = String(v);
  if (cle === "date" && /^\d{4}-\d{2}-\d{2}$/.test(t)) return dateLongue(t);
  return VALEURS_REPONSES[cle]?.[t] ?? t;
}

export function texteReponses(reponses: Record<string, unknown>): string {
  return Object.entries(reponses)
    .filter(([, v]) => v !== "" && v !== false && v !== null && v !== undefined)
    .map(([k, v]) => `${libelleReponse(k)} : ${valeurReponse(k, v)}`)
    .join(" | ");
}

/** Date et heure de Douala, « 2026-10-14 09:05 ». */
export function dateHeureDouala(d: Date): string {
  return new Date(d.getTime() + 36e5).toISOString().slice(0, 16).replace("T", " ");
}

export const MAX_EXPORT = 10_000;

export async function exporterCsv(f: Filtres): Promise<{ csv: string; nombre: number }> {
  const lignes = await db()
    .select()
    .from(demande)
    .where(conditions(f))
    .orderBy(desc(demande.creeLe))
    .limit(MAX_EXPORT);
  const csv = versCsv(
    ["Référence", "Créée le (Douala)", "Type", "Statut", "Nom", "WhatsApp", "Réponses", "Annonces", "Source", "utm_source", "utm_medium", "utm_campaign", "Site d’origine", "Envoi", "Mise à jour"],
    lignes.map((d) => [
      d.reference,
      dateHeureDouala(d.creeLe),
      LIBELLES_TYPE[d.type],
      LIBELLES_STATUT[d.statut as Statut],
      d.nom,
      d.whatsappE164,
      texteReponses((d.reponses ?? {}) as Record<string, unknown>),
      d.annonces ? "oui" : "non",
      d.sourceCode,
      d.utmSource,
      d.utmMedium,
      d.utmCampaign,
      d.referentDomaine,
      d.modeEnvoi === "js" ? "formulaire" : "sans JavaScript",
      dateHeureDouala(d.majLe),
    ]),
  );
  return { csv, nombre: lignes.length };
}

// ---------------------------------------------------------------------------
// Tableau de bord

export async function indicateursDemandes() {
  const limite = new Date(Date.now() - RELANCE_HEURES * 36e5);
  const [nouvelles] = await db().select({ n: count() }).from(demande).where(eq(demande.statut, "nouvelle"));
  const [relance] = await db()
    .select({ n: count() })
    .from(demande)
    .where(and(notInArray(demande.statut, STATUTS_CLOS), lt(demande.statutChangeLe, limite)));
  const [emails] = await db().select({ n: count() }).from(emailSortant).where(eq(emailSortant.statut, "echec"));
  const dernieres = await db()
    .select(colonnesListe)
    .from(demande)
    .where(inArray(demande.statut, ["nouvelle"]))
    .orderBy(desc(demande.creeLe))
    .limit(5);
  const aRelancer = await db()
    .select(colonnesListe)
    .from(demande)
    .where(and(notInArray(demande.statut, STATUTS_CLOS), lt(demande.statutChangeLe, limite)))
    .orderBy(demande.statutChangeLe)
    .limit(5);
  return { nouvelles: nouvelles?.n ?? 0, aRelancer: relance?.n ?? 0, emailsEchec: emails?.n ?? 0, dernieres, listeRelance: aRelancer };
}
