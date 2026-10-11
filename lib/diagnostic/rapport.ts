// Rapport de diagnostic de l’hébergement (GET /api/sante avec le jeton) : vérifie
// chaque hypothèse Hostinger de l’architecture §16 sur le serveur réel.
// Ne contient aucune valeur secrète ni donnée personnelle : noms de variables,
// codes d’erreur, versions, et adresses IP tronquées.

import "server-only";
import { readFile, rm, statfs, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { count, desc } from "drizzle-orm";
import type { RowDataPacket } from "mysql2";
import {
  ConfigurationIncomplete,
  VARIABLES_ATTENDUES,
  configBase,
  configSecrets,
  configSite,
  configSmtp,
  configTaches,
  dossierTeleversement,
} from "@/lib/config";
import { base, db } from "@/lib/db/client";
import { DOSSIER_MIGRATIONS } from "@/lib/db/migrer";
import { demarrageServeur, emailSortant, tacheExecution } from "@/lib/db/schema";
import { codeErreur } from "@/lib/journal";
import { transport } from "@/lib/mail/transport";
import { estDans } from "@/lib/medias/stockage";
import { identifiantBuild, identifiantBuildFichier } from "@/lib/serveur/build";
import { analyserEntetesIp } from "./ip";
import { lireMarqueur } from "./persistance";

type Echec = { ok: false; erreur: string; variables?: string[] };

function echec(e: unknown): Echec {
  if (e instanceof ConfigurationIncomplete) return { ok: false, erreur: "configuration incomplète", variables: e.variables };
  return { ok: false, erreur: codeErreur(e) };
}

async function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  let minuteur: NodeJS.Timeout | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(Object.assign(new Error("délai dépassé"), { code: "DELAI_DEPASSE" })), ms);
  });
  try {
    return await Promise.race([promesse, delai]);
  } finally {
    clearTimeout(minuteur);
  }
}

function environnement() {
  const domaines = Object.fromEntries(
    Object.entries(VARIABLES_ATTENDUES).map(([domaine, noms]) => [
      domaine,
      { absentes: noms.filter((n) => !process.env[n]?.trim()) },
    ]),
  );
  const validations: Record<string, true | Echec> = {};
  const essais = { site: configSite, base: configBase, smtp: configSmtp, secrets: configSecrets, taches: configTaches, televersement: dossierTeleversement };
  for (const [nom, lire] of Object.entries(essais)) {
    try {
      lire();
      validations[nom] = true;
    } catch (e) {
      validations[nom] = echec(e);
    }
  }
  return { domaines, validations };
}

async function verifierBase() {
  try {
    const debut = performance.now();
    const [[serveur]] = await base().pool.query<RowDataPacket[]>(
      "SELECT VERSION() AS version, @@session.time_zone AS fuseau, @@character_set_database AS jeu, @@collation_database AS collation, NOW(3) AS maintenant",
    );
    const latenceMs = Math.round(performance.now() - debut);

    // Écriture réelle dans une transaction annulée : aucune trace.
    const connexion = await base().pool.getConnection();
    let ecriture: true | Echec;
    try {
      await connexion.beginTransaction();
      await connexion.query("INSERT INTO tache_execution (tache, declencheur, statut, detail) VALUES (?, ?, ?, ?)", ["diagnostic", "manuel", "ok", "essai d’écriture"]);
      await connexion.rollback();
      ecriture = true;
    } catch (e) {
      await connexion.rollback().catch(() => {});
      ecriture = echec(e);
    } finally {
      connexion.release();
    }

    const journalMigrations = JSON.parse(await readFile(path.join(DOSSIER_MIGRATIONS, "meta", "_journal.json"), "utf8")) as { entries: unknown[] };
    const [[migrations]] = await base().pool.query<RowDataPacket[]>("SELECT COUNT(*) AS appliquees, MAX(created_at) AS derniere FROM __drizzle_migrations");

    const taches = await db().select().from(tacheExecution).orderBy(desc(tacheExecution.id)).limit(10);
    const demarrages = await db().select().from(demarrageServeur).orderBy(desc(demarrageServeur.id)).limit(10);
    const emails = await db().select({ statut: emailSortant.statut, nombre: count() }).from(emailSortant).groupBy(emailSortant.statut);

    return {
      ok: ecriture === true,
      serveur,
      latenceMs,
      ecriture,
      migrations: { attendues: journalMigrations.entries.length, appliquees: Number(migrations?.appliquees ?? 0), derniere: migrations?.derniere ?? null },
      dernieresTaches: taches.map((t) => ({ tache: t.tache, declencheur: t.declencheur, statut: t.statut, debutLe: t.debutLe, finLe: t.finLe, detail: t.detail })),
      derniersDemarrages: demarrages.map((d) => ({ build: d.build, node: d.versionNode, le: d.demarreLe })),
      emails: Object.fromEntries(emails.map((e) => [e.statut, e.nombre])),
    };
  } catch (e) {
    return echec(e);
  }
}

async function verifierTeleversement() {
  try {
    const racine = dossierTeleversement();
    const avertissements: string[] = [];
    // En développement, uploads/ dans le projet est normal ; en production, cwd est le dossier déployé.
    if (process.env.NODE_ENV === "production" && estDans(racine, process.cwd())) avertissements.push("UPLOAD_DIR est dans le dossier de l’application : il sera effacé au prochain déploiement");
    if (racine.split(path.sep).includes("hbuilds")) avertissements.push("UPLOAD_DIR est dans hbuilds/, géré par les déploiements Hostinger");

    await mkdir(racine, { recursive: true });
    const essai = path.join(racine, `.essai-${process.pid}-${Date.now()}`);
    await writeFile(essai, "essai", "utf8");
    const relu = await readFile(essai, "utf8");
    await rm(essai);

    const espace = await statfs(racine);
    const marqueur = await lireMarqueur(racine);
    const builds = new Set(marqueur?.builds.map((b) => b.build) ?? []);
    return {
      ok: relu === "essai" && avertissements.length === 0,
      chemin: racine,
      ecritureLecture: relu === "essai",
      espaceLibreMo: Math.round((espace.bavail * espace.bsize) / 1024 / 1024),
      avertissements,
      persistance: {
        buildsVus: marqueur?.builds ?? [],
        // Confirmée dès que le marqueur a survécu à au moins un nouveau déploiement.
        confirmee: builds.size >= 2,
      },
    };
  } catch (e) {
    return echec(e);
  }
}

async function verifierSharp() {
  try {
    const sharp = (await import("sharp")).default;
    const tampon = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#2f6b3a" } })
      .webp({ quality: 80 })
      .toBuffer();
    const meta = await sharp(tampon).metadata();
    let image: string | null = null;
    try {
      const dossier = path.join(dossierTeleversement(), "diagnostic");
      await mkdir(dossier, { recursive: true });
      const nom = `sharp-${identifiantBuildFichier()}.webp`;
      await writeFile(path.join(dossier, nom), tampon);
      image = `/medias/diagnostic/${nom}`;
    } catch {
      image = null;
    }
    return {
      ok: meta.format === "webp" && meta.width === 64,
      versions: sharp.versions,
      plateforme: `${process.platform}-${process.arch}`,
      octetsWebp: tampon.length,
      image,
    };
  } catch (e) {
    // Le message de sharp (module ou bibliothèque introuvable, plateforme) est
    // indispensable au diagnostic et ne contient aucune donnée personnelle.
    const message = e instanceof Error ? e.message.split("\n").slice(0, 3).join(" ").slice(0, 400) : undefined;
    return { ...echec(e), message, plateforme: `${process.platform}-${process.arch}` };
  }
}

async function verifierSmtp() {
  try {
    const c = configSmtp();
    await avecDelai(transport().verify(), 20_000);
    return { ok: true, hote: c.hote, port: c.port, tlsDirect: c.securise };
  } catch (e) {
    return echec(e);
  }
}

function analyserRequete(entetes: Headers) {
  return {
    entetes: [...entetes.keys()].sort(),
    ip: analyserEntetesIp(entetes),
    protocole: entetes.get("x-forwarded-proto"),
    hote: entetes.get("host"),
    via: entetes.get("via"),
  };
}

export async function rapportComplet(entetes: Headers) {
  const [baseDeDonnees, televersement, sharp, smtp] = await Promise.all([
    avecDelai(verifierBase(), 20_000).catch(echec),
    avecDelai(verifierTeleversement(), 10_000).catch(echec),
    avecDelai(verifierSharp(), 15_000).catch(echec),
    verifierSmtp(),
  ]);
  const memoire = process.memoryUsage();
  return {
    genereLe: new Date().toISOString(),
    node: {
      version: process.version,
      plateforme: `${process.platform}-${process.arch}`,
      environnement: process.env.NODE_ENV ?? null,
      build: identifiantBuild(),
      dossier: process.cwd(),
      dureeFonctionnementS: Math.round(process.uptime()),
      memoireMo: { rss: Math.round(memoire.rss / 1048576), tas: Math.round(memoire.heapUsed / 1048576) },
      port: process.env.PORT ?? null,
    },
    environnement: environnement(),
    base: baseDeDonnees,
    televersement,
    sharp,
    smtp,
    requete: analyserRequete(entetes),
  };
}
