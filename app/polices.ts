// Polices auto-hébergées, extraites de la maquette (reference/extrait/polices,
// copies identiques : mêmes empreintes SHA-256). next/font/local les déclare et
// les précharge ; leurs familles sont exposées dans --police-titre et
// --police-texte, que app/maquette.css reprend dans --font-display et --font-text.
// Les polices de repli sont celles de la maquette (« Display Fallback », « Text
// Fallback », déclarées dans maquette.css avec leurs métriques ajustées) : pas
// d’ajustement automatique ici. next/font les insère telles quelles, d’où les guillemets.

import localFont from "next/font/local";

export const policeTitre = localFont({
  src: [{ path: "./polices/bricolage-grotesque-800.woff2", weight: "800", style: "normal" }],
  variable: "--police-titre",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["'Display Fallback'", "Arial", "sans-serif"],
});

export const policeTexte = localFont({
  src: [
    { path: "./polices/figtree-400.woff2", weight: "400", style: "normal" },
    { path: "./polices/figtree-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--police-texte",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["'Text Fallback'", "system-ui", "sans-serif"],
});
