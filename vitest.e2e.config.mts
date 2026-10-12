// Tests de bout en bout (Playwright, Chrome installé) contre un site qui tourne :
// HPF_SITE_URL (défaut http://127.0.0.1:3100). Les tests de publication écrivent en
// base : le serveur et les tests utilisent la base de test (défaut hpf_test) :
//   npm run build && DB_NAME=hpf_test PORT=3100 npm run standalone
// puis npm run test:e2e.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  /* pas de .env : variables déjà présentes dans l’environnement */
}
process.env.DB_NAME = process.env.HPF_TEST_DB_NAME ?? "hpf_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/vide.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Un seul navigateur à la fois : ce poste est modeste, et les mesures restent stables.
    fileParallelism: false,
  },
});
