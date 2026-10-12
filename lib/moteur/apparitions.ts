// Section 10 de reference/extrait/principal.js : apparitions au défilement.
// Chaque bloc [data-reveal] apparaît une fois, en arrivant à l’écran ; dans un
// groupe [data-stagger], les éléments se suivent de 90 ms. Les éléments déjà
// visibles au démarrage du moteur ne sont jamais masqués.

import { $$, type Contexte } from "./outils";

export function apparitions(ctx: Contexte): void {
  const elements = $$("[data-reveal], [data-animate]");
  if (!(ctx.aIO && elements.length && ctx.racine.classList.contains("motion") && !ctx.mouvementReduit.matches)) {
    elements.forEach((el) => el.classList.add("is-in"));
    return;
  }
  $$("[data-stagger]").forEach((groupe) => {
    let i = 0;
    Array.from(groupe.children).forEach((enfant) => {
      if (enfant instanceof HTMLElement && enfant.hasAttribute("data-reveal")) {
        enfant.style.setProperty("--d", String(Math.min(i++, 6)));
      }
    });
  });
  const vh = window.innerHeight;
  elements.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.top < vh && r.bottom > 0) el.classList.add("is-in");
  });
  ctx.racine.classList.add("reveal-on");
  const observateur = new IntersectionObserver(
    (entrees) => {
      entrees.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        observateur.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
  );
  elements.forEach((el) => {
    if (!el.classList.contains("is-in")) observateur.observe(el);
  });
}
