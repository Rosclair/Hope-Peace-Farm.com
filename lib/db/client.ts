// Connexion MySQL/MariaDB (mysql2) et instance Drizzle, créées à la première
// utilisation puis partagées (un seul pool par processus, même en développement
// où les modules sont rechargés). Toutes les requêtes passent par Drizzle ou par
// des requêtes paramétrées : jamais de concaténation SQL.

import "server-only";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { configBase } from "@/lib/config";
import * as schema from "./schema";

type Base = { pool: mysql.Pool; db: MySql2Database<typeof schema> };

const global_ = globalThis as typeof globalThis & { __hpfBase?: Base };

function creer(): Base {
  const c = configBase();
  const pool = mysql.createPool({
    host: c.DB_HOST,
    port: c.DB_PORT,
    user: c.DB_USER,
    password: c.DB_PASSWORD,
    database: c.DB_NAME,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
    connectTimeout: 10_000,
    enableKeepAlive: true,
  });
  // Dates en UTC côté serveur aussi (CURRENT_TIMESTAMP des valeurs par défaut).
  pool.pool.on("connection", (connexion) => {
    connexion.query("SET time_zone = '+00:00'");
  });
  return { pool, db: drizzle({ client: pool, schema, mode: "default" }) };
}

export function base(): Base {
  global_.__hpfBase ??= creer();
  return global_.__hpfBase;
}

export function db() {
  return base().db;
}

/**
 * Exécute `travail` en tenant un verrou nommé MySQL (GET_LOCK), sur une connexion
 * réservée. Renvoie `null` sans rien exécuter si le verrou est déjà pris.
 */
export async function avecVerrou<T>(nom: string, attenteSecondes: number, travail: () => Promise<T>): Promise<T | null> {
  const connexion = await base().pool.getConnection();
  try {
    const [lignes] = await connexion.query<mysql.RowDataPacket[]>("SELECT GET_LOCK(?, ?) AS obtenu", [nom, attenteSecondes]);
    if (lignes[0]?.obtenu !== 1) return null;
    try {
      return await travail();
    } finally {
      await connexion.query("SELECT RELEASE_LOCK(?)", [nom]);
    }
  } finally {
    connexion.release();
  }
}
