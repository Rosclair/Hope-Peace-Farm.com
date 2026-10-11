// Configuration Next.js. Hostinger l’exige sous forme d’objet (pas de fonction)
// et impose `output: "standalone"` ; on le pose aussi ici pour que les essais
// locaux tournent dans les mêmes conditions que la production.

/** En-têtes de sécurité de base ; la politique CSP complète arrive en phase 7. */
const entetesSecurite = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
];

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  cacheComponents: true,
  // Recommandé par Next 16.4 pour un nouveau projet avec cacheComponents.
  partialPrefetching: true,
  // Pas de fichier AGENTS.md généré par `next dev` : les règles du projet sont dans CLAUDE.md.
  agentRules: false,
  // Copiés dans la sortie standalone : les migrations SQL, lues au démarrage
  // (instrumentation.ts), et les paquets natifs de sharp (@img/…) en entier : le
  // traçage copie le module .node mais pas les bibliothèques libvips qu’il charge
  // (libvips-42.dll sous Windows, paquet sharp-libvips-linux-x64 sous Linux).
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*", "./node_modules/@img/**/*"],
  },
  async headers() {
    return [{ source: "/:chemin*", headers: entetesSecurite }];
  },
};

export default config;
