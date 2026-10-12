// Accès en base au contenu de la page : brouillon, versions publiées, état de
// publication (docs/modele-donnees.md §1, architecture §10). Publier et revenir en
// arrière sont des copies atomiques, sous verrou MySQL et dans une transaction.
// La revalidation du cache de la page revient à l’appelant : action serveur du
// back-office (updateTag, phase 5) ou route POST /api/contenu/revalider.

import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { avecVerrou, db } from "@/lib/db/client";
import { contenuBrouillon, etatPublication, versionContenu } from "@/lib/db/schema";
import { journal } from "@/lib/journal";
import { controlerPublication, type Probleme } from "./controles";
import { empreinteContenu } from "./empreinte";
import { A_CONFIRMER_INITIAL, CONTENU_INITIAL } from "./initial";
import { schemaContenu } from "./schema";

const ID_UNIQUE = 1;
const VERROU = "hpf_contenu";
const ATTENTE_VERROU_S = 15;

export class VerrouOccupe extends Error {
  constructor() {
    super("Une autre opération sur le contenu est en cours ; réessayez.");
    this.name = "VerrouOccupe";
  }
}

/** Le brouillon a été modifié entre-temps (verrou optimiste) : recharger avant d’enregistrer. */
export class ConflitBrouillon extends Error {
  constructor(readonly revisionActuelle: number) {
    super("Le brouillon a été modifié entre-temps : rechargez-le avant d’enregistrer.");
    this.name = "ConflitBrouillon";
  }
}

/** Contenu refusé (enregistrement, publication ou retour arrière) : liste des problèmes. */
export class ContenuRefuse extends Error {
  constructor(readonly problemes: Probleme[]) {
    super(`Contenu refusé : ${problemes.filter((p) => p.bloquant).length} problème(s) bloquant(s).`);
    this.name = "ContenuRefuse";
  }
}

export class VersionIntrouvable extends Error {
  constructor(readonly numero: number) {
    super(`Version n° ${numero} introuvable.`);
    this.name = "VersionIntrouvable";
  }
}

const listeChemins = (valeur: unknown): string[] =>
  Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === "string") : [];

async function sousVerrou<T>(travail: () => Promise<T>): Promise<T> {
  const r = await avecVerrou(VERROU, ATTENTE_VERROU_S, async () => ({ valeur: await travail() }));
  if (!r) throw new VerrouOccupe();
  return r.valeur;
}

// ---------------------------------------------------------------------------
// Lecture

export interface VersionEnLigne {
  numero: number;
  donnees: unknown;
  aConfirmer: string[];
  empreinte: string;
  publieLe: Date;
}

export async function lireVersionEnLigne(): Promise<VersionEnLigne | null> {
  const [ligne] = await db()
    .select({
      numero: versionContenu.numero,
      donnees: versionContenu.donnees,
      aConfirmer: versionContenu.aConfirmer,
      empreinte: versionContenu.empreinte,
      publieLe: versionContenu.publieLe,
    })
    .from(etatPublication)
    .innerJoin(versionContenu, eq(versionContenu.numero, etatPublication.versionEnLigne))
    .where(eq(etatPublication.id, ID_UNIQUE))
    .limit(1);
  return ligne ? { ...ligne, aConfirmer: listeChemins(ligne.aConfirmer) } : null;
}

export interface Brouillon {
  donnees: unknown;
  aConfirmer: string[];
  revision: number;
  modifieLe: Date;
  modifiePar: string;
}

export async function lireBrouillon(): Promise<Brouillon | null> {
  const [ligne] = await db().select().from(contenuBrouillon).where(eq(contenuBrouillon.id, ID_UNIQUE)).limit(1);
  return ligne ? { ...ligne, aConfirmer: listeChemins(ligne.aConfirmer) } : null;
}

export interface LigneHistorique {
  numero: number;
  publieLe: Date;
  publiePar: string;
  restaureeDepuis: number | null;
  note: string | null;
  empreinte: string;
  enLigne: boolean;
}

export async function historique(limite = 50): Promise<LigneHistorique[]> {
  const [etat] = await db().select().from(etatPublication).where(eq(etatPublication.id, ID_UNIQUE)).limit(1);
  const lignes = await db()
    .select({
      numero: versionContenu.numero,
      publieLe: versionContenu.publieLe,
      publiePar: versionContenu.publiePar,
      restaureeDepuis: versionContenu.restaureeDepuis,
      note: versionContenu.note,
      empreinte: versionContenu.empreinte,
    })
    .from(versionContenu)
    .orderBy(desc(versionContenu.numero))
    .limit(limite);
  return lignes.map((l) => ({ ...l, enLigne: l.numero === etat?.versionEnLigne }));
}

// ---------------------------------------------------------------------------
// Écriture

/**
 * Enregistre le brouillon complet si sa révision n’a pas changé depuis sa lecture.
 * Le document doit respecter le schéma (les contrôles de publication, eux, ne
 * s’appliquent qu’à la publication : un brouillon peut contenir « […] »).
 */
export async function enregistrerBrouillon(args: {
  donnees: unknown;
  aConfirmer: readonly string[];
  revisionAttendue: number;
  par: string;
}): Promise<{ revision: number }> {
  const analyse = schemaContenu.safeParse(args.donnees);
  if (!analyse.success) throw new ContenuRefuse(controlerPublication(args.donnees).problemes);
  const [resultat] = await db()
    .update(contenuBrouillon)
    .set({
      donnees: analyse.data,
      aConfirmer: [...new Set(args.aConfirmer)],
      revision: sql`${contenuBrouillon.revision} + 1`,
      modifieLe: sql`CURRENT_TIMESTAMP(3)`,
      modifiePar: args.par.slice(0, 120),
    })
    .where(sql`${contenuBrouillon.id} = ${ID_UNIQUE} AND ${contenuBrouillon.revision} = ${args.revisionAttendue}`);
  if (resultat.affectedRows !== 1) {
    const actuel = await lireBrouillon();
    throw new ConflitBrouillon(actuel?.revision ?? 0);
  }
  journal.info("brouillon enregistré", { revision: args.revisionAttendue + 1 });
  return { revision: args.revisionAttendue + 1 };
}

export type ResultatPublication =
  | { statut: "publiee"; numero: number; avertissements: Probleme[] }
  | { statut: "inchangee"; numero: number };

/** Publie le brouillon : contrôles, nouvelle version immuable, version en ligne. */
export async function publier(args: { par: string; note?: string }): Promise<ResultatPublication> {
  const resultat = await sousVerrou(() =>
    db().transaction(async (tx) => {
      const [brouillon] = await tx.select().from(contenuBrouillon).where(eq(contenuBrouillon.id, ID_UNIQUE)).for("update");
      if (!brouillon) throw new ContenuRefuse([{ chemin: "", message: "Aucun brouillon : contenu non initialisé.", bloquant: true }]);
      const aConfirmer = listeChemins(brouillon.aConfirmer);
      const controle = controlerPublication(brouillon.donnees, aConfirmer);
      if (!controle.publiable || !controle.contenu) throw new ContenuRefuse(controle.problemes);

      const empreinte = empreinteContenu(controle.contenu);
      const [etat] = await tx.select().from(etatPublication).where(eq(etatPublication.id, ID_UNIQUE)).for("update");
      if (etat) {
        const [enLigne] = await tx.select({ empreinte: versionContenu.empreinte }).from(versionContenu).where(eq(versionContenu.numero, etat.versionEnLigne));
        if (enLigne?.empreinte === empreinte) return { statut: "inchangee" as const, numero: etat.versionEnLigne };
      }
      const numero = await prochainNumero(tx);
      await tx.insert(versionContenu).values({
        numero,
        donnees: controle.contenu,
        aConfirmer,
        empreinte,
        publiePar: args.par.slice(0, 120),
        note: args.note?.slice(0, 200) || null,
      });
      await definirEnLigne(tx, numero, Boolean(etat));
      return { statut: "publiee" as const, numero, avertissements: controle.problemes };
    }),
  );
  journal.info("publication", { statut: resultat.statut, numero: resultat.numero });
  return resultat;
}

export interface ResultatRestauration {
  statut: "restauree" | "inchangee";
  /** Numéro désormais en ligne. */
  numero: number;
  depuis: number;
  /** Le brouillon contenait des modifications non publiées, remplacées par la version restaurée. */
  modificationsRemplacees: boolean;
}

/**
 * Retour arrière : republie la version `depuis` sous un nouveau numéro (« restaurée
 * depuis la n° X ») et remet le brouillon à son contenu, pour qu’une publication
 * suivante ne ramène pas l’erreur corrigée.
 */
export async function restaurer(depuis: number, args: { par: string; note?: string }): Promise<ResultatRestauration> {
  const resultat = await sousVerrou(() =>
    db().transaction(async (tx) => {
      const [source] = await tx.select().from(versionContenu).where(eq(versionContenu.numero, depuis));
      if (!source) throw new VersionIntrouvable(depuis);
      const aConfirmer = listeChemins(source.aConfirmer);
      // Une ancienne version doit encore passer les contrôles (le schéma a pu évoluer).
      const controle = controlerPublication(source.donnees, aConfirmer);
      if (!controle.publiable || !controle.contenu) throw new ContenuRefuse(controle.problemes);

      const [etat] = await tx.select().from(etatPublication).where(eq(etatPublication.id, ID_UNIQUE)).for("update");
      const [brouillon] = await tx.select().from(contenuBrouillon).where(eq(contenuBrouillon.id, ID_UNIQUE)).for("update");
      const [enLigne] = etat
        ? await tx.select({ empreinte: versionContenu.empreinte }).from(versionContenu).where(eq(versionContenu.numero, etat.versionEnLigne))
        : [];
      const modificationsRemplacees = Boolean(brouillon && enLigne && empreinteContenu(brouillon.donnees) !== enLigne.empreinte);

      let numero = etat?.versionEnLigne ?? 0;
      let statut: ResultatRestauration["statut"] = "inchangee";
      if (!enLigne || enLigne.empreinte !== source.empreinte) {
        numero = await prochainNumero(tx);
        await tx.insert(versionContenu).values({
          numero,
          donnees: controle.contenu,
          aConfirmer,
          empreinte: source.empreinte,
          publiePar: args.par.slice(0, 120),
          restaureeDepuis: depuis,
          note: (args.note ?? `Restaurée depuis la version n° ${depuis}`).slice(0, 200),
        });
        await definirEnLigne(tx, numero, Boolean(etat));
        statut = "restauree";
      }
      if (brouillon) {
        await tx
          .update(contenuBrouillon)
          .set({
            donnees: controle.contenu,
            aConfirmer,
            revision: sql`${contenuBrouillon.revision} + 1`,
            modifieLe: sql`CURRENT_TIMESTAMP(3)`,
            modifiePar: args.par.slice(0, 120),
          })
          .where(eq(contenuBrouillon.id, ID_UNIQUE));
      }
      return { statut, numero, depuis, modificationsRemplacees };
    }),
  );
  journal.info("retour arrière", { statut: resultat.statut, numero: resultat.numero, depuis });
  return resultat;
}

/**
 * Données initiales (= maquette) si la base est vide : brouillon, version n° 1 et
 * état de publication. Sans effet si le contenu existe déjà. Appelée au démarrage
 * du serveur et par `npm run db:initialiser`.
 */
export async function initialiserSiVide(par = "initialisation"): Promise<"cree" | "existant"> {
  return sousVerrou(() =>
    db().transaction(async (tx) => {
      const [etat] = await tx.select().from(etatPublication).where(eq(etatPublication.id, ID_UNIQUE));
      if (etat) return "existant" as const;
      const donnees = schemaContenu.parse(CONTENU_INITIAL);
      const empreinte = empreinteContenu(donnees);
      const [existante] = await tx.select({ numero: versionContenu.numero }).from(versionContenu).orderBy(desc(versionContenu.numero)).limit(1);
      const numero = existante ? existante.numero + 1 : 1;
      await tx.insert(versionContenu).values({
        numero,
        donnees,
        aConfirmer: A_CONFIRMER_INITIAL,
        empreinte,
        publiePar: par,
        note: "Contenu de la maquette",
      });
      const [brouillon] = await tx.select({ id: contenuBrouillon.id }).from(contenuBrouillon).where(eq(contenuBrouillon.id, ID_UNIQUE));
      if (!brouillon) {
        await tx.insert(contenuBrouillon).values({ id: ID_UNIQUE, donnees, aConfirmer: A_CONFIRMER_INITIAL, modifiePar: par });
      }
      await definirEnLigne(tx, numero, false);
      return "cree" as const;
    }),
  );
}

// ---------------------------------------------------------------------------

type Transaction = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

async function prochainNumero(tx: Transaction): Promise<number> {
  const [r] = await tx.select({ max: sql<number | null>`MAX(${versionContenu.numero})` }).from(versionContenu);
  return Number(r?.max ?? 0) + 1;
}

async function definirEnLigne(tx: Transaction, numero: number, existe: boolean): Promise<void> {
  if (existe) {
    await tx
      .update(etatPublication)
      .set({ versionEnLigne: numero, modifieLe: sql`CURRENT_TIMESTAMP(3)` })
      .where(eq(etatPublication.id, ID_UNIQUE));
  } else {
    await tx.insert(etatPublication).values({ id: ID_UNIQUE, versionEnLigne: numero });
  }
}
