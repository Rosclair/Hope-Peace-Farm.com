// Sections 1 à 5 de reference/extrait/principal.js : Fêtes, menu mobile, section
// en cours, barre fixe WhatsApp / Appeler, mentions légales et confidentialité.

import { messageFetesGaranti, lienWa } from "@/lib/whatsapp/messages";
import { $, $$, type Contexte } from "./outils";

/* ---------- 1. Bandeau et bloc des Fêtes ---------- */
export function fetes(ctx: Contexte): void {
  const lien = $<HTMLAnchorElement>("#fetes-reserver");
  const limite = ctx.racine.dataset.fetesDeadline;
  if (lien && ctx.racine.classList.contains("fetes-garanti") && limite) {
    lien.href = lienWa(ctx.wa, messageFetesGaranti(limite));
  }
  annonceFetes(ctx);
}

/* Bandeau des Fêtes en notification : masqué au chargement, il apparaît après un
   délai et ne revient plus, dans la session, une fois fermé (ou son lien suivi). */
const CLE_ANNONCE = "hpf-annonce-fetes-fermee";
const DELAI_ANNONCE = 4000;

function annonceFetes(ctx: Contexte): void {
  const annonce = $(".banner");
  if (!annonce || ctx.racine.classList.contains("fetes-fin")) return;
  try {
    if (sessionStorage.getItem(CLE_ANNONCE)) return;
  } catch {
    /* stockage indisponible : l’annonce s’affiche quand même */
  }
  const fermer = () => {
    annonce.classList.remove("banner--visible");
    try {
      sessionStorage.setItem(CLE_ANNONCE, "1");
    } catch {
      /* rien à retenir */
    }
  };
  $("button.banner__close", annonce)?.addEventListener("click", fermer);
  $("a", annonce)?.addEventListener("click", fermer);
  window.setTimeout(() => annonce.classList.add("banner--visible"), DELAI_ANNONCE);
}

/* ---------- 2. Menu mobile ---------- */
export function menu(): void {
  const menu = $<HTMLDetailsElement>(".menu");
  if (!menu) return;
  const bouton = $("summary", menu);
  const derriere = $$("body > main, body > footer, body > .bar, body > .banner, .brand, .skip-link");
  menu.addEventListener("toggle", () => derriere.forEach((el) => el.toggleAttribute("inert", menu.open)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      bouton?.focus();
    }
  });
  menu.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) menu.open = false;
  });
  window.matchMedia("(min-width: 70em)").addEventListener("change", (event) => {
    if (event.matches) menu.open = false;
  });
}

/* ---------- 3. Section en cours dans le menu ---------- */
export function sectionCourante(ctx: Contexte): void {
  const liens = $$(".nav__link, .menu__link");
  if (!ctx.aIO || !liens.length) return;
  const sections = ["ceremonies", "poulets", "professionnels", "livraison", "la-ferme", "questions"]
    .map((id) => document.getElementById(id))
    .filter((s): s is HTMLElement => Boolean(s));
  const visibles = new Set<Element>();
  const marquer = () => {
    const courante = sections.find((s) => visibles.has(s));
    liens.forEach((lien) => {
      if (courante && lien.getAttribute("href") === `#${courante.id}`) lien.setAttribute("aria-current", "location");
      else lien.removeAttribute("aria-current");
    });
  };
  const espion = new IntersectionObserver(
    (entrees) => {
      entrees.forEach((e) => (e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target)));
      marquer();
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  sections.forEach((s) => espion.observe(s));
}

/* ---------- 4. Barre fixe WhatsApp / Appeler ----------
   Masquée tant qu’un bouton principal ou le formulaire est visible, et pendant
   la saisie. Sur la landing épinglée, les boutons du héros comptent comme
   partis dès que le texte s’est effacé (classe .is-cta-off posée par la landing).
   Renvoie la fonction de mise à jour, appelée aussi par la landing. */
export function barreFixe(ctx: Contexte): () => void {
  const barre = $(".bar");
  if (!barre) return () => {};
  const surveilles = new Set<Element>();
  let saisie = false;
  let minuteur = 0;
  const ctaVisible = () => Array.from(surveilles).some((el) => !el.closest(".is-cta-off"));
  const maj = () => {
    barre.classList.toggle("is-hidden", ctaVisible() || saisie);
  };

  if (ctx.aIO) {
    const observateur = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => (e.isIntersecting ? surveilles.add(e.target) : surveilles.delete(e.target)));
      maj();
      barre.classList.add("is-ready");
    });
    [...$$("[data-primary-cta]"), $(".request__card")]
      .filter((el): el is HTMLElement => Boolean(el))
      .forEach((el) => observateur.observe(el));
  } else {
    barre.classList.add("is-ready");
  }

  const champTexte = (el: EventTarget | null) =>
    el instanceof Element &&
    el.matches('textarea, input[type="text"], input[type="date"], input[type="tel"], input:not([type])');
  document.addEventListener("focusin", (event) => {
    if (!champTexte(event.target)) return;
    clearTimeout(minuteur);
    saisie = true;
    maj();
  });
  document.addEventListener("focusout", (event) => {
    if (!champTexte(event.target)) return;
    minuteur = window.setTimeout(() => {
      saisie = false;
      maj();
    }, 100);
  });
  return maj;
}

/* ---------- 5. Mentions légales et confidentialité ---------- */
export function details(): void {
  const ouvrirDepuisAncre = () => {
    const cible = location.hash && document.getElementById(location.hash.slice(1));
    if (cible instanceof HTMLDetailsElement) cible.open = true;
  };
  $$<HTMLAnchorElement>("[data-open-details]").forEach((lien) =>
    lien.addEventListener("click", () => {
      const cible = document.getElementById((lien.getAttribute("href") ?? "").slice(1));
      if (cible instanceof HTMLDetailsElement) cible.open = true;
    }),
  );
  window.addEventListener("hashchange", ouvrirDepuisAncre);
  ouvrirDepuisAncre();
}
