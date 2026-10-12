// Tests d’intégration sur une vraie base MySQL/MariaDB (npm run test:base). Ils
// effacent le contenu de la base : ils ne tournent que sur une base dont le nom
// finit par « _test » (défaut : hpf_test ; autre nom : HPF_TEST_DB_NAME).

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  /* pas de .env : variables déjà présentes dans l’environnement */
}
process.env.DB_NAME = process.env.HPF_TEST_DB_NAME ?? "hpf_test";
if (!process.env.DB_NAME.endsWith("_test")) throw new Error(`Base de test refusée : ${process.env.DB_NAME} (le nom doit finir par _test)`);

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/vide.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/base/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
