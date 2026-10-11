// Variantes de diagnostic de la maquette (copies, jamais l'original) : chacune retire
// un ingrédient pour mesurer son coût dans Lighthouse.
export const VARIANTES = {
  base: (h) => h,
  "sans-logo": (h) => h.replace(/<use href="#(lg-[a-z-]+|logo)"\s*\/>/g, ""),
  "sans-motion": (h) => h.replace('h.classList.add("motion");', ""),
  "sans-scrolly": (h) => h.replace('h.classList.add("scrolly")', "0"),
  "sans-assemblage": (h) => h.replace("@media (prefers-reduced-motion: no-preference) {\n  .motion .hero__emblem::before", "@media (min-width: 9999px) {\n  .motion .hero__emblem::before"),
  "sans-apparitions": (h) => h.replace("root.classList.add('reveal-on');", ""),
  "sans-fonts-ready": (h) => h.replace("if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { evaluateLanding(); measureRead(); requestFrame(); });", ""),
  "polices-repli": (h) => h.replaceAll('font-family: "Bricolage Grotesque";\n', 'font-family: "Inutilisee1";\n').replaceAll('font-family: "Figtree";\n', 'font-family: "Inutilisee2";\n'),
  // Polices de repli sans recherche local() des polices système
  "sans-local": (h) => h.replace(/@font-face \{\n  font-family: "(Display|Text) Fallback";\n  src: [^;]+;/g, (m, f) => `@font-face {\n  font-family: "${f} Fallback";\n  src: url("data:,");`),
  // Piste d'optimisation sans effet visuel : ne calculer les sections hors écran qu'à leur approche
  "content-visibility": (h) => h.replace("</style>", "main > section:not(.hero), .footer { content-visibility: auto; contain-intrinsic-size: auto 1200px; }\n</style>"),
};
VARIANTES["sans-local+content-visibility"] = (h) => VARIANTES["content-visibility"](VARIANTES["sans-local"](h));
