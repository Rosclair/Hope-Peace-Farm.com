// Section 6 de reference/extrait/principal.js : « Votre demande », onglets et
// formulaires. Préparés à l’approche du formulaire, ou tout de suite si l’adresse
// y mène ou si l’on touche un lien vers la demande : le premier affichage reste léger.
// Messages et remerciements : lib/whatsapp/messages.ts (partagé avec les tests).

import { composerMessage, lienWa, texteRemerciement, type Reponses, type TypeDemande } from "@/lib/whatsapp/messages";
import { $, $$, type Contexte } from "./outils";

const ANCRE_VERS_TYPE: Record<string, TypeDemande> = { "#devis": "ceremonie", "#commande": "poulets", "#essai": "pro" };

const OBLIGATOIRE: Record<TypeDemande, string> = {
  ceremonie: "Ce champ est nécessaire pour préparer votre devis.",
  poulets: "Ce champ est nécessaire pour préparer votre commande.",
  pro: "Ce champ est nécessaire pour préparer votre livraison d’essai.",
};

const propre = (v: unknown) => String(v || "").replace(/\s+/g, " ").trim();

export function demande(ctx: Contexte): void {
  const carte = $(".request__card");
  if (!carte) return;
  let pret = false;
  const demarrer = () => {
    if (pret) return;
    pret = true;
    preparer(ctx, carte);
  };
  if (!ctx.aIO || ANCRE_VERS_TYPE[location.hash] || location.hash === "#demande") {
    demarrer();
    return;
  }
  const proche = new IntersectionObserver(
    (entrees) => {
      if (entrees.some((e) => e.isIntersecting)) {
        proche.disconnect();
        demarrer();
      }
    },
    { rootMargin: "800px 0px" },
  );
  proche.observe(carte);
  /* Phase de capture : le formulaire est prêt avant que le lien touché ne réagisse */
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element && event.target.closest('[data-demande], a[href="#demande"]')) demarrer();
    },
    true,
  );
  window.addEventListener("hashchange", demarrer);
  /* Toucher ou atteindre au clavier un élément du formulaire : prêt avant le « click » */
  carte.addEventListener("pointerdown", demarrer, true);
  carte.addEventListener("focusin", demarrer, true);
}

function preparer(ctx: Contexte, carte: HTMLElement): void {
  const onglets = $$<HTMLInputElement>('input[name="type-demande"]', carte);
  const formulaires = Object.fromEntries($$<HTMLFormElement>(".rform", carte).map((f) => [f.dataset.form, f])) as Partial<
    Record<TypeDemande, HTMLFormElement>
  >;

  const choisir = (type: string | undefined | null, garder = true) => {
    if (!type || !(type in formulaires)) return;
    onglets.forEach((t) => {
      t.checked = t.value === type;
    });
    Object.entries(formulaires).forEach(([cle, f]) => f?.classList.toggle("is-current", cle === type));
    if (garder) ctx.sauver("hpf-type", type);
  };

  onglets.forEach((t) => t.addEventListener("change", () => choisir(t.value)));
  $$("[data-demande]").forEach((lien) => lien.addEventListener("click", () => choisir(lien.dataset.demande)));

  window.addEventListener("hashchange", () => {
    if (ANCRE_VERS_TYPE[location.hash]) choisir(ANCRE_VERS_TYPE[location.hash]);
  });
  choisir(ANCRE_VERS_TYPE[location.hash] ?? ctx.lire<string>("hpf-type") ?? "ceremonie", false);

  /* Bornes des champs date */
  $$<HTMLInputElement>("input[data-date]", carte).forEach((champ) => {
    champ.min = ctx.aujourdhui;
    champ.max = ctx.dateMax;
  });

  (Object.entries(formulaires) as [TypeDemande, HTMLFormElement][]).forEach(([type, form]) =>
    formulaire(ctx, type, form),
  );
}

function formulaire(ctx: Contexte, type: TypeDemande, form: HTMLFormElement): void {
  const etapes = $$(".rstep", form);
  const etapeNum = $("[data-step-now]", form);
  const jauge = $(".progress__bar span", form);
  const resume = $(".errors", form);
  const succes = $(".done", form);
  if (!etapeNum || !jauge || !resume || !succes) return;
  let index = 0;

  resume.tabIndex = -1;
  $$(".field", form).forEach((champ, i) => {
    const erreur = $(".field__error", champ);
    if (erreur) erreur.id = `${type}-err-${i}`;
    $$<HTMLInputElement>('input[type="radio"]', champ).forEach((radio, j) => {
      if (!radio.id) radio.id = `${type}-${radio.name}-${j}`;
    });
  });

  const valeurs = (): Reponses => {
    const d: Reponses = {};
    new FormData(form).forEach((valeur, cle) => {
      d[cle] = String(valeur);
    });
    return d;
  };

  /* Brouillon gardé le temps de la visite */
  const cleBrouillon = `hpf-form-${type}`;
  const brouillon = ctx.lire<Reponses>(cleBrouillon);
  if (brouillon) {
    Array.from(form.elements).forEach((el) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (!el.name || !(el.name in brouillon)) return;
      if (el instanceof HTMLInputElement && el.type === "radio") el.checked = brouillon[el.name] === el.value;
      else if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = Boolean(brouillon[el.name]);
      else el.value = brouillon[el.name] ?? "";
    });
  }
  const garder = () => {
    ctx.sauver(cleBrouillon, valeurs());
    ctx.sauver("hpf-type", type);
  };
  form.addEventListener("input", garder);
  form.addEventListener("change", garder);

  /* Compteur − / + */
  $$<HTMLButtonElement>("[data-count]", form).forEach((bouton) =>
    bouton.addEventListener("click", () => {
      const champ = bouton.parentElement && $<HTMLInputElement>("input", bouton.parentElement);
      if (!champ) return;
      const n = parseInt(champ.value, 10) || 0;
      champ.value = String(Math.min(9999, Math.max(1, n + Number(bouton.dataset.count))));
      champ.dispatchEvent(new Event("input", { bubbles: true }));
    }),
  );

  /* Libellé repris dans le résumé des erreurs (« Où habitez-vous ? », espace insécable) */
  const libelle = (champ: Element) => propre($(".field__label", champ)?.textContent).replace(/\s*\?$/, " ?");

  /** Le champ de saisie d’un bloc (ni case à cocher, ni bouton radio pour les puces). */
  const controle = (champ: Element) =>
    $<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea', champ);

  const verifier = (champ: HTMLElement): string => {
    const d = valeurs();
    const nom = champ.dataset.field;
    const radios = $$<HTMLInputElement>('input[type="radio"]', champ);
    if (radios.length) return radios.some((r) => r.checked) ? "" : OBLIGATOIRE[type];

    const saisie = controle(champ);
    if (!saisie) return "";
    const valeur = saisie.value.trim();
    if (type === "poulets" && nom === "lieu" && d.reception !== "livraison") return "";
    if (type === "ceremonie" && nom === "date" && d.date_inconnue) return "";
    if (!valeur) return saisie.required || nom === "lieu" ? OBLIGATOIRE[type] : "";
    if (nom === "nombre" && !/^[1-9][0-9]{0,3}$/.test(valeur)) return "Indiquez un nombre de poulets, par exemple 10.";
    if (saisie.type === "date") {
      if (valeur < ctx.aujourdhui) return "Choisissez une date à partir d’aujourd’hui.";
      if (valeur > ctx.dateMax) return "Choisissez une date dans les douze prochains mois.";
    }
    return "";
  };

  const afficher = (champ: HTMLElement, message: string) => {
    const erreur = $(".field__error", champ);
    const controles = $$<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea', champ);
    champ.toggleAttribute("data-invalid", Boolean(message));
    if (erreur) {
      erreur.textContent = message;
      erreur.hidden = !message;
    }
    controles.forEach((c) => {
      if (!("baseDescribedby" in c.dataset)) c.dataset.baseDescribedby = c.getAttribute("aria-describedby") ?? "";
      const base = c.dataset.baseDescribedby ?? "";
      if (message) {
        c.setAttribute("aria-invalid", "true");
        if (c.type !== "radio" && erreur) c.setAttribute("aria-describedby", `${base} ${erreur.id}`.trim());
      } else {
        c.removeAttribute("aria-invalid");
        if (base) c.setAttribute("aria-describedby", base);
        else c.removeAttribute("aria-describedby");
      }
    });
    if (champ.tagName === "FIELDSET" && erreur) {
      if (message) champ.setAttribute("aria-describedby", erreur.id);
      else champ.removeAttribute("aria-describedby");
    }
  };

  const validerEtape = (etape: HTMLElement): boolean => {
    const problemes: { champ: HTMLElement; message: string }[] = [];
    $$(".field", etape).forEach((champ) => {
      if (champ.offsetParent === null && !champ.matches(".field--livraison")) return;
      const message = verifier(champ);
      afficher(champ, message);
      if (message) problemes.push({ champ, message });
    });
    const liste = $("ul", resume);
    if (liste) {
      liste.textContent = "";
      problemes.forEach(({ champ, message }) => {
        const cible = controle(champ);
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `#${cible?.id ?? ""}`;
        a.textContent = `${libelle(champ)} : ${message}`;
        a.addEventListener("click", (event) => {
          event.preventDefault();
          cible?.focus();
        });
        li.append(a);
        liste.append(li);
      });
    }
    resume.hidden = problemes.length === 0;
    if (problemes.length) resume.focus();
    return problemes.length === 0;
  };

  /* Une erreur affichée se met à jour dès que la réponse change */
  form.addEventListener("change", (event) => {
    if (!(event.target instanceof Element)) return;
    const champ = event.target.closest<HTMLElement>(".field");
    if (champ?.hasAttribute("data-invalid")) afficher(champ, verifier(champ));
    if ((event.target as HTMLInputElement).name === "date_inconnue") {
      const champDate = event.target.closest<HTMLElement>(".field");
      if (champDate?.hasAttribute("data-invalid")) afficher(champDate, verifier(champDate));
    }
  });
  /* Un champ en erreur se corrige pendant la frappe : le message disparaît
     tout de suite, et la mise en page ne bouge pas au moment où l’on touche
     le champ suivant (sinon le toucher peut tomber à côté). */
  form.addEventListener("input", (event) => {
    if (!(event.target instanceof Element)) return;
    const champ = event.target.closest<HTMLElement>(".field");
    if (champ?.hasAttribute("data-invalid")) afficher(champ, verifier(champ));
  });

  const allerA = (suivant: number, focus = true) => {
    index = Math.max(0, Math.min(etapes.length - 1, suivant));
    etapes.forEach((s, i) => s.classList.toggle("is-active", i === index));
    etapeNum.textContent = String(index + 1);
    jauge.style.setProperty("--progress", String((index + 1) / etapes.length));
    resume.hidden = true;
    const etape = etapes[index];
    if (focus && etape) $(".rstep__title", etape)?.focus();
  };

  const terminer = () => {
    const d = valeurs();
    const message = composerMessage(type, d);
    const texte = $("[data-done-text]", succes);
    if (texte) texte.textContent = texteRemerciement(type, d);
    const condoleances = $("[data-done-extra]", succes);
    if (condoleances) condoleances.hidden = d.ceremonie !== "funerailles";
    const citation = $("[data-done-message]", succes);
    if (citation) citation.textContent = message;
    const lien = $<HTMLAnchorElement>("[data-done-wa]", succes);
    if (lien) lien.href = lienWa(ctx.wa, message);
    const secours = $<HTMLTextAreaElement>(".done__fallback", succes);
    if (secours) {
      secours.value = message;
      secours.hidden = true;
    }
    $$(".rform__intro, .progress, .errors, .rstep", form).forEach((el) => {
      el.hidden = true;
    });
    succes.hidden = false;
    $(".done__title", succes)?.focus();
  };

  $$("[data-next]", form).forEach((bouton) =>
    bouton.addEventListener("click", () => {
      const etape = etapes[index];
      if (etape && validerEtape(etape)) allerA(index + 1);
    }),
  );
  $$("[data-prev]", form).forEach((bouton) => bouton.addEventListener("click", () => allerA(index - 1)));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const etape = etapes[index];
    if (!etape || !validerEtape(etape)) return;
    if (index < etapes.length - 1) allerA(index + 1);
    else terminer();
  });

  $("[data-edit]", succes)?.addEventListener("click", () => {
    succes.hidden = true;
    $$(".rform__intro, .progress, .rstep", form).forEach((el) => {
      el.hidden = false;
    });
    allerA(0);
  });

  /* Copier le message */
  const copier = $("[data-copy]", succes);
  const libelleCopie = copier && $("span", copier);
  copier?.addEventListener("click", async () => {
    const texte = $("[data-done-message]", succes)?.textContent ?? "";
    if (!libelleCopie) return;
    try {
      await navigator.clipboard.writeText(texte);
      libelleCopie.textContent = "Message copié";
      setTimeout(() => {
        libelleCopie.textContent = "Copier le message";
      }, 2000);
    } catch {
      const secours = $<HTMLTextAreaElement>(".done__fallback", succes);
      if (secours) {
        secours.hidden = false;
        secours.focus();
        secours.select();
      }
      libelleCopie.textContent = "Appuyez longuement sur le message pour le copier.";
    }
  });

  allerA(0, false);
}
