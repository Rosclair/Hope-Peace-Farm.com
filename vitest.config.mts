import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // « server-only » refuse d’être importé hors du serveur Next : neutre en test.
      "server-only": fileURLToPath(new URL("./tests/vide.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unitaires/**/*.test.ts"],
    environment: "node",
  },
});
