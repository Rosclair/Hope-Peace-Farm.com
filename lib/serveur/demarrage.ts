// Travaux lancés une fois au démarrage du processus Node (instrumentation.ts) :
// migrations, trace du démarrage, marqueur de persistance d’UPLOAD_DIR et, si
// demandé, minuteur interne des tâches. Aucune erreur ici n’empêche le site de
// répondre : elles sont journalisées et visibles dans le diagnostic.

import "server-only";
import { configTaches, dossierTeleversement } from "@/lib/config";
import { db } from "@/lib/db/client";
import { appliquerMigrations } from "@/lib/db/migrer";
import { demarrageServeur } from "@/lib/db/schema";
import { noterBuild } from "@/lib/diagnostic/persistance";
import { codeErreur, journal } from "@/lib/journal";
import { executerTachesDues } from "@/lib/taches/executer";
import { identifiantBuild } from "./build";

const global_ = globalThis as typeof globalThis & { __hpfDemarre?: boolean };

export async function demarrerServeur(): Promise<void> {
  if (global_.__hpfDemarre) return;
  global_.__hpfDemarre = true;

  const build = identifiantBuild();
  journal.info("démarrage", { build, node: process.version, environnement: process.env.NODE_ENV ?? "?" });

  try {
    const etat = await appliquerMigrations();
    journal.info("migrations", { etat });
    await db().insert(demarrageServeur).values({ build, versionNode: process.version });
  } catch (e) {
    journal.erreur("base indisponible au démarrage", { erreur: codeErreur(e) });
  }

  try {
    await noterBuild(dossierTeleversement(), build);
  } catch (e) {
    journal.erreur("UPLOAD_DIR inutilisable au démarrage", { erreur: codeErreur(e) });
  }

  lancerMinuteur();
}

/**
 * Minuteur interne, en secours du cron (désactivé par défaut). Hostinger arrête le
 * processus après une période sans trafic : il ne remplace donc pas un vrai cron.
 */
function lancerMinuteur() {
  let minutes = 0;
  try {
    minutes = configTaches().TACHES_MINUTEUR_MINUTES;
  } catch (e) {
    journal.avertissement("TACHES_MINUTEUR_MINUTES invalide, minuteur désactivé", { erreur: codeErreur(e) });
  }
  if (minutes === 0) return;
  const minuteur = setInterval(() => {
    executerTachesDues("minuteur").catch((e) => journal.erreur("minuteur des tâches", { erreur: codeErreur(e) }));
  }, minutes * 60_000);
  minuteur.unref();
  journal.info("minuteur des tâches lancé", { minutes });
}
