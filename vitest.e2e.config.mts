// Tests de bout en bout (Playwright, Chrome installé) contre un site qui tourne :
// HPF_SITE_URL (défaut http://127.0.0.1:3100, serveur standalone : npm run build
// puis PORT=3100 npm run standalone). Lancement : npm run test:e2e.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
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
