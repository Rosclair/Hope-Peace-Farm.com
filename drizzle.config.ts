// drizzle-kit : `npm run db:generer` écrit une nouvelle migration SQL dans drizzle/
// à partir du schéma. Aucune connexion à la base n’est nécessaire pour générer.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
