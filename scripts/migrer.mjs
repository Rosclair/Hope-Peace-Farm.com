// Applique les migrations de drizzle/ (en local, ou par SSH chez l’hébergeur).
// En production, elles s’appliquent aussi toutes seules au démarrage du serveur.
// Usage : npm run db:migrer  (lit .env)

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const manquantes = ["DB_HOST", "DB_NAME", "DB_USER"].filter((n) => !process.env[n]);
if (manquantes.length) {
  console.error(`Variables manquantes : ${manquantes.join(", ")} (voir .env.example)`);
  process.exit(1);
}

const connexion = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME,
  charset: "utf8mb4_unicode_ci",
  timezone: "Z",
});
try {
  await connexion.query("SET time_zone = '+00:00'");
  const [[verrou]] = await connexion.query("SELECT GET_LOCK('hpf_migrations', 60) AS obtenu");
  if (verrou.obtenu !== 1) throw new Error("verrou hpf_migrations indisponible (migration déjà en cours ?)");
  await migrate(drizzle({ client: connexion }), { migrationsFolder: "drizzle" });
  const [[etat]] = await connexion.query("SELECT COUNT(*) AS n FROM __drizzle_migrations");
  console.log(`Migrations appliquées : ${etat.n}`);
} finally {
  await connexion.end();
}
