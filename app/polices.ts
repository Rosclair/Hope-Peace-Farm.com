// Polices auto-hébergées, extraites de la maquette (reference/extrait/polices,
// copies identiques : mêmes empreintes SHA-256). Les polices de repli ajustées
// de la maquette (« Display Fallback », « Text Fallback ») seront reprises telles
// quelles avec son CSS en phase 2 : pas d’ajustement automatique ici.

import localFont from "next/font/local";

export const policeTitre = localFont({
  src: [{ path: "./polices/bricolage-grotesque-800.woff2", weight: "800", style: "normal" }],
  variable: "--police-titre",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Arial", "sans-serif"],
});

export const policeTexte = localFont({
  src: [
    { path: "./polices/figtree-400.woff2", weight: "400", style: "normal" },
    { path: "./polices/figtree-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--police-texte",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});
