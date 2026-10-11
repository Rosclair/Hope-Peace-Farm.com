// Migrations Drizzle appliquées au démarrage du serveur (instrumentation.ts) :
// Hostinger lance lui-même `next start` et ne permet pas de commande avant le
// démarrage. Les fichiers SQL de `drizzle/` sont copiés dans la sortie
// standalone (outputFileTracingIncludes, next.config.mjs). Un verrou MySQL évite
// deux migrations simultanées.

import "server-only";
import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { avecVerrou, db } from "./client";

export const DOSSIER_MIGRATIONS = path.join(process.cwd(), "drizzle");

export async function appliquerMigrations(): Promise<"appliquees" | "deja_en_cours"> {
  const resultat = await avecVerrou("hpf_migrations", 60, async () => {
    await migrate(db(), { migrationsFolder: DOSSIER_MIGRATIONS });
    return "appliquees" as const;
  });
  return resultat ?? "deja_en_cours";
}
