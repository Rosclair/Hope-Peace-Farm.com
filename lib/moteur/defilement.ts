// Sections 8 et 9 de reference/extrait/principal.js : landing épinglée au
// défilement, en-tête (ombre) et barre de lecture.
//
// La scène du héros reste fixe pendant ~2 écrans de défilement. Le moteur ne
// fait que lire la position de défilement et poser des variables CSS
// (--dock, --out, --card, --live, --s, --f, --foot) : le style décide du rendu,
// uniquement en transform et opacity. Mobile : l’emblème se range dans l’en-tête,
// le texte monte puis s’efface, le suivi arrive et ses étapes se cochent.
// Ordinateur : même récit, texte fixe à gauche. Aucun état React.

import { $, $$, clamp, type Contexte } from "./outils";

const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const bell = (t: number) => Math.sin(Math.PI * t);

type Plage = readonly [number, number];
interface Plan {
  dock: Plage;
  card: Plage;
  steps: Plage;
  foot: Plage;
  out?: Plage;
  live?: Plage;
  hint?: Plage;
}

/* Calendrier du récit, en fraction du défilement épinglé (0 → 1) */
const PLAN: { mobile: Plan; desktop: Plan } = {
  mobile: { dock: [0.02, 0.2], out: [0.27, 0.41], card: [0.41, 0.58], steps: [0.6, 0.91], foot: [0.91, 0.97] },
  desktop: { live: [0, 0.2], dock: [0.2, 0.42], card: [0.4, 0.58], steps: [0.6, 0.91], foot: [0.91, 0.97], hint: [0, 0.05] },
};
const VARIABLES_HERO = ["--out", "--card", "--card-o", "--live", "--hint"];

export function defilement(ctx: Contexte, majBarre: () => void): void {
  const { racine } = ctx;
  const hero = $(".hero");
  const scene = $(".hero__stage");
  const texteHero = $(".hero__text");
  const embleme = $(".hero__emblem");
  const suivi = $(".suivi");
  const etapesSuivi = $$(".suivi__step");
  const entete = $(".header");
  const logoMarque = $(".brand__logo");
  const logoVolant = $(".dock-logo");
  const ordinateur = window.matchMedia("(min-width: 64em)");
  if (!entete) return;

  let geo = { total: 0, hauteurEntete: 0, ordinateur: false };
  let dernierP = -1;
  let etatDock = "";
  let tailleDock = 0;
  let ctaParti = false;

  const scrollyActif = () => racine.classList.contains("scrolly");
  const poser = (el: HTMLElement, nom: string, valeur: number) => el.style.setProperty(nom, valeur.toFixed(4));

  const mesurer = () => {
    if (!hero || !scene) return;
    geo = {
      total: Math.max(1, hero.offsetHeight - scene.offsetHeight),
      hauteurEntete: entete.offsetHeight,
      ordinateur: ordinateur.matches,
    };
  };

  /* Le texte (une fois l’emblème rangé) et le suivi doivent tenir dans la scène,
     même avec une police agrandie ; sinon, page statique. */
  const tient = () => {
    if (!scene || !texteHero || !suivi) return false;
    const place = scene.clientHeight;
    if (!place) return false;
    if (geo.ordinateur) return texteHero.offsetHeight <= place - 48 && suivi.offsetHeight <= place - 32;
    return texteHero.offsetHeight + 16 <= place && suivi.offsetHeight <= place - 24;
  };

  const reinitialiser = () => {
    if (!hero || !suivi) return;
    VARIABLES_HERO.forEach((v) => hero.style.removeProperty(v));
    racine.style.removeProperty("--dock");
    racine.style.removeProperty("--brand");
    etapesSuivi.forEach((li) => {
      li.style.removeProperty("--s");
      li.style.removeProperty("--f");
    });
    suivi.style.removeProperty("--foot");
    racine.classList.remove("docking", "docked");
    texteHero?.classList.remove("is-cta-off");
    etatDock = "";
    dernierP = -1;
    if (ctaParti) {
      ctaParti = false;
      majBarre();
    }
  };

  const placerDock = (t: number, de: DOMRect | null, vers: DOMRect | null) => {
    const etat = t <= 0 ? "idle" : t >= 1 ? "docked" : "docking";
    if (etat !== etatDock) {
      etatDock = etat;
      racine.classList.toggle("docking", etat === "docking");
      racine.classList.toggle("docked", etat === "docked");
    }
    if (etat !== "docking" || !de || !vers || !de.width || !vers.width || !logoVolant) return;
    if (tailleDock !== de.width) {
      tailleDock = de.width;
      logoVolant.style.width = `${de.width}px`;
      logoVolant.style.height = `${de.width}px`;
    }
    /* Mobile : trajet courbe, le logo glisse d’abord vers la gauche puis monte
       dans sa place (il arrive par-dessous au lieu de passer sur le nom).
       Ordinateur : ligne droite, dans l’espace libre au-dessus du titre. */
    const courbe = !geo.ordinateur;
    const tx = courbe ? 1 - (1 - t) * (1 - t) : t;
    const ty = courbe ? t * t : t;
    const x = de.left + (vers.left - de.left) * tx;
    const y = de.top + (vers.top - de.top) * ty;
    const s = 1 + (vers.width / de.width - 1) * t;
    logoVolant.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
  };

  const rendreLanding = () => {
    if (!hero || !suivi || !embleme || !logoMarque || !texteHero || !scrollyActif()) return;
    /* Lectures d’abord, écritures ensuite : aucun aller-retour de mise en page */
    const haut = hero.getBoundingClientRect().top;
    const p = clamp((geo.hauteurEntete - haut) / geo.total, 0, 1);
    if (Math.abs(p - dernierP) < 0.0001) return;
    dernierP = p;
    const plan = geo.ordinateur ? PLAN.desktop : PLAN.mobile;
    const dock = easeInOut(seg(p, plan.dock[0], plan.dock[1]));
    const enRoute = dock > 0 && dock < 1;
    const de = enRoute ? embleme.getBoundingClientRect() : null;
    const vers = enRoute ? logoMarque.getBoundingClientRect() : null;

    poser(racine, "--dock", dock); /* sur <html> : lu aussi par l’en-tête */
    poser(racine, "--brand", easeOut(seg(p, plan.dock[0], plan.dock[0] + (plan.dock[1] - plan.dock[0]) * 0.6)));
    poser(hero, "--card", easeOut(seg(p, plan.card[0], plan.card[1])));
    poser(hero, "--card-o", seg(p, plan.card[0], plan.card[0] + (plan.card[1] - plan.card[0]) * 0.55));
    if (plan.out) poser(hero, "--out", easeInOut(seg(p, plan.out[0], plan.out[1])));
    if (plan.live) poser(hero, "--live", bell(seg(p, plan.live[0], plan.live[1])));
    if (plan.hint) poser(hero, "--hint", 1 - seg(p, plan.hint[0], plan.hint[1]));

    const [sa, sb] = plan.steps;
    const w = (sb - sa) / etapesSuivi.length;
    etapesSuivi.forEach((li, i) => {
      const a = sa + i * w;
      poser(li, "--s", easeOut(seg(p, a, a + w * 0.55)));
      poser(li, "--f", seg(p, a + w * 0.55, a + w));
    });
    poser(suivi, "--foot", easeOut(seg(p, plan.foot[0], plan.foot[1])));

    placerDock(dock, de, vers);

    const parti = plan.out ? seg(p, plan.out[0], plan.out[1]) > 0.5 : false;
    if (parti !== ctaParti) {
      ctaParti = parti;
      texteHero.classList.toggle("is-cta-off", parti);
      majBarre();
    }
  };

  /* Active ou coupe la landing épinglée selon l’écran (décision initiale
     prise dans <head> pour éviter tout saut de mise en page). */
  const evaluerLanding = () => {
    if (!hero) return;
    const voulu =
      racine.classList.contains("motion") &&
      !ctx.mouvementReduit.matches &&
      ctx.aIO &&
      window.innerHeight >= 600 &&
      window.innerWidth >= 300;
    racine.classList.toggle("scrolly", voulu);
    if (voulu) {
      mesurer();
      if (!tient()) racine.classList.remove("scrolly");
    }
    reinitialiser();
    if (scrollyActif()) {
      mesurer();
      rendreLanding();
    }
  };

  /* ---------- 9. En-tête : ombre et barre de lecture ---------- */
  let lectureMax = 1;
  let finAccueil = 0;
  const mesurerLecture = () => {
    lectureMax = Math.max(1, racine.scrollHeight - window.innerHeight);
    finAccueil = hero ? hero.offsetTop + hero.offsetHeight : 0;
  };

  /* Écart à la maquette (audit UX) : sur mobile, l’en-tête se retire quand on
     descend après l’accueil et revient dès qu’on remonte (translation seule ; le
     style limite l’effet aux petits écrans). Jamais pendant la landing épinglée,
     ni quand le menu est ouvert ou que le focus est dans l’en-tête. */
  const menuMobile = $<HTMLDetailsElement>(".menu");
  let yPrecedent = 0;
  let masque = false;
  const masquer = (oui: boolean) => {
    if (oui === masque) return;
    masque = oui;
    entete.classList.toggle("is-masque", oui);
  };
  entete.addEventListener("focusin", () => masquer(false));
  menuMobile?.addEventListener("toggle", () => masquer(false));

  const rendreEntete = () => {
    const y = window.scrollY || racine.scrollTop;
    entete.classList.toggle("is-scrolled", y > 4);
    entete.style.setProperty("--read", clamp(y / lectureMax, 0, 1).toFixed(4));
    const delta = y - yPrecedent;
    if (Math.abs(delta) < 8) return;
    yPrecedent = y;
    const bloque = menuMobile?.open || entete.contains(document.activeElement);
    masquer(!bloque && delta > 0 && y > Math.max(finAccueil, window.innerHeight));
  };

  let enAttente = false;
  const image = () => {
    enAttente = false;
    rendreLanding();
    rendreEntete();
  };
  const demanderImage = () => {
    if (enAttente) return;
    enAttente = true;
    window.requestAnimationFrame(image);
  };

  if (hero) evaluerLanding();
  mesurerLecture();
  rendreEntete();
  window.addEventListener("scroll", demanderImage, { passive: true });

  let minuteurRedim = 0;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(minuteurRedim);
      minuteurRedim = window.setTimeout(() => {
        evaluerLanding();
        mesurerLecture();
        demanderImage();
      }, 120);
    },
    { passive: true },
  );
  /* Les polices chargées peuvent changer la hauteur du texte */
  document.fonts?.ready.then(() => {
    evaluerLanding();
    mesurerLecture();
    demanderImage();
  });
  /* La maquette attend « load » ; ici le moteur peut démarrer après (hydratation) */
  const auChargement = () => {
    mesurerLecture();
    demanderImage();
  };
  if (document.readyState === "complete") auChargement();
  else window.addEventListener("load", auChargement);
  /* Les questions dépliées changent la hauteur de la page */
  document.addEventListener(
    "toggle",
    () => {
      mesurerLecture();
      demanderImage();
    },
    true,
  );

  ctx.mouvementReduit.addEventListener("change", () => {
    racine.classList.toggle("motion", !ctx.mouvementReduit.matches);
    evaluerLanding();
    demanderImage();
  });
}
