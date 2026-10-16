// Section 6 de reference/extrait/principal.js : « Votre demande », onglets et
// formulaires. Préparés à l’approche du formulaire, ou tout de suite si l’adresse
// y mène ou si l’on touche un lien vers la demande : le premier affichage reste léger.
// Messages et remerciements : lib/whatsapp/messages.ts (partagé avec les tests).
// Phase 4 : la demande est envoyée à /api/demandes, qui répond par le message suivi
// de sa référence. Sans réseau ou en cas d’erreur, le navigateur compose lui-même le
// message (sans référence), garde la saisie et propose « Réessayer » ; la même clé
// d’envoi évite un doublon si la première tentative était arrivée. WhatsApp ne
// s’ouvre jamais tout seul.

import { normaliserNumero } from "@/lib/demandes/numero";
import { fcfa } from "@/lib/contenu/format";
import { composerMessage, dateMessage, lienWa, texteRemerciement, type Reponses, type TypeDemande } from "@/lib/whatsapp/messages";
import { $, $$, type Contexte } from "./outils";

const ANCRE_VERS_TYPE: Record<string, TypeDemande> = { "#devis": "ceremonie", "#commande": "poulets", "#essai": "pro" };

const OBLIGATOIRE: Record<TypeDemande, string> = {
  ceremonie: "Ce champ est nécessaire pour préparer votre devis.",
  poulets: "Ce champ est nécessaire pour préparer votre commande.",
  pro: "Ce champ est nécessaire pour préparer votre livraison d’essai.",
};

const NUMERO_INVALIDE =
  "Indiquez un numéro WhatsApp valide, par exemple 6\u00a093\u00a064\u00a055\u00a065, ou avec l’indicatif hors du Cameroun.";
const ACCORD = "Cochez cette case\u00a0: nous vous répondons sur WhatsApp.";
/** Délai au-delà duquel l’envoi est abandonné au profit du repli. */
const DELAI_ENVOI_MS = 20_000;

const propre = (v: unknown) => String(v || "").replace(/\s+/g, " ").trim();

/** Clé d’envoi aléatoire (crypto.randomUUID manque avant Safari 15.4). */
function nouvelleCle(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (o) => o.toString(16).padStart(2, "0")).join("");
}

/** Source de la visite : lien de campagne (?src=), paramètres utm_*, domaine d’origine. */
function sourceVisite(): Record<string, string> {
  const source: Record<string, string> = {};
  const p = new URLSearchParams(location.search);
  for (const cle of ["src", "utm_source", "utm_medium", "utm_campaign"]) {
    const v = p.get(cle);
    if (v) source[cle] = v;
  }
  try {
    const origine = document.referrer ? new URL(document.referrer).hostname : "";
    if (origine && origine !== location.hostname) source.referent = origine;
  } catch {
    /* adresse d’origine illisible */
  }
  return source;
}

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
  /* Cartes des préparations : la préparation choisie est cochée d’avance */
  $$("[data-preparation]").forEach((lien) =>
    lien.addEventListener("click", () => {
      const option = $<HTMLInputElement>(`input[name="preparation"][value="${lien.dataset.preparation}"]`, formulaires.poulets);
      if (!option) return;
      option.checked = true;
      option.dispatchEvent(new Event("change", { bubbles: true }));
    }),
  );

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

/* ---------- Récapitulatif en direct (audit UX) ----------
   Reprend les réponses données, avec leur libellé, sous le formulaire ; pour les
   poulets, une estimation « à partir de » (nombre × prix unitaire de la préparation).
   Coordonnées et accord n’y figurent pas. */
const HORS_RECAP = new Set(["whatsapp", "consentement"]);

function recapitulatif(form: HTMLFormElement): () => void {
  const recap = $("[data-recap]", form);
  const liste = recap && $(".recap__liste", recap);
  const blocPrix = recap && $("[data-recap-prix]", recap);
  if (!recap || !liste || !blocPrix) return () => {};
  let prix: Record<string, number> = {};
  try {
    prix = JSON.parse(recap.dataset.prix ?? "{}") as Record<string, number>;
  } catch {
    /* pas d’estimation */
  }

  const reponse = (champ: HTMLElement): string => {
    const coche = $<HTMLInputElement>("input[type=radio]:checked", champ);
    if (coche) return propre(coche.closest("label")?.textContent);
    const saisie = $<HTMLInputElement | HTMLTextAreaElement>("input:not([type=radio]):not([type=checkbox]), textarea", champ);
    if (!saisie) return "";
    if (saisie.type === "date") {
      if ($<HTMLInputElement>('input[name="date_inconnue"]', champ)?.checked) return "à confirmer";
      return saisie.value ? dateMessage(saisie.value) : "";
    }
    const v = propre(saisie.value);
    return v.length > 80 ? `${v.slice(0, 79)}…` : v;
  };

  return () => {
    const lignes: [string, string][] = [];
    $$("[data-field]", form).forEach((champ) => {
      if (HORS_RECAP.has(champ.dataset.field ?? "")) return;
      const valeur = reponse(champ);
      const libelle = propre($(".field__label", champ)?.textContent);
      if (valeur && libelle) lignes.push([libelle, valeur]);
    });
    liste.replaceChildren(
      ...lignes.flatMap(([l, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = l;
        const dd = document.createElement("dd");
        dd.textContent = v;
        return [dt, dd];
      }),
    );
    const n = parseInt($<HTMLInputElement>('input[name="nombre"]', form)?.value ?? "", 10);
    const unitaire = prix[$<HTMLInputElement>('input[name="preparation"]:checked', form)?.value ?? ""];
    const estimation = n > 0 && unitaire ? n * unitaire : 0;
    blocPrix.textContent = estimation
      ? `À partir de ${fcfa(estimation)} (${n} × ${fcfa(unitaire!)}), hors livraison. Le prix final est écrit sur votre devis.`
      : "";
    blocPrix.hidden = !estimation;
    recap.hidden = lignes.length < 2;
  };
}

function formulaire(ctx: Contexte, type: TypeDemande, form: HTMLFormElement): void {
  const etapes = $$(".rstep", form);
  const etapeNum = $("[data-step-now]", form);
  const jauge = $(".progress__bar span", form);
  const resume = $(".errors", form);
  const succes = $(".done", form);
  if (!etapeNum || !jauge || !resume || !succes) return;
  let index = 0;
  const prepareLe = performance.now();
  const source = sourceVisite();
  let cle = nouvelleCle();

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

  const majRecap = recapitulatif(form);
  form.addEventListener("input", majRecap);
  form.addEventListener("change", majRecap);
  majRecap();

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
  const libelle = (champ: Element) => propre(($(".field__label", champ) ?? $(".check span", champ))?.textContent).replace(/\s*\?$/, " ?");

  /** Le champ de saisie d’un bloc (pas la case « date pas encore fixée ») ; la case seule pour l’accord. */
  const controle = (champ: Element) =>
    $<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea', champ) ??
    $<HTMLInputElement>('input[type="checkbox"]', champ);

  const verifier = (champ: HTMLElement): string => {
    const d = valeurs();
    const nom = champ.dataset.field;
    const radios = $$<HTMLInputElement>('input[type="radio"]', champ);
    if (radios.length) return radios.some((r) => r.checked) ? "" : OBLIGATOIRE[type];
    if (nom === "consentement") return $<HTMLInputElement>('input[type="checkbox"]', champ)?.checked ? "" : ACCORD;

    const saisie = controle(champ);
    if (!saisie) return "";
    const valeur = saisie.value.trim();
    if (type === "poulets" && nom === "lieu" && d.reception !== "livraison") return "";
    if (type === "ceremonie" && nom === "date" && d.date_inconnue) return "";
    if (!valeur) return saisie.required || nom === "lieu" ? OBLIGATOIRE[type] : "";
    if (nom === "nombre" && !/^[1-9][0-9]{0,3}$/.test(valeur)) return "Indiquez un nombre de poulets, par exemple 10.";
    if (nom === "whatsapp" && !normaliserNumero(valeur)) return NUMERO_INVALIDE;
    if (saisie.type === "date") {
      if (valeur < ctx.aujourdhui) return "Choisissez une date à partir d’aujourd’hui.";
      if (valeur > ctx.dateMax) return "Choisissez une date dans les douze prochains mois.";
    }
    return "";
  };

  const afficher = (champ: HTMLElement, message: string) => {
    const erreur = $(".field__error", champ);
    let controles = $$<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea', champ);
    if (!controles.length) controles = $$<HTMLInputElement>('input[type="checkbox"]', champ);
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

  const envoi = $<HTMLButtonElement>('button[type="submit"]', form);
  const reessai = $<HTMLButtonElement>("[data-retry]", succes);
  const alerte = $("[data-done-erreur]", succes);
  let enCours = false;

  /** Vue de succès de la maquette ; `repli` : la demande n’a pas été enregistrée. */
  const terminer = (message: string, lienWhatsapp: string, repli: boolean) => {
    const d = valeurs();
    const texte = $("[data-done-text]", succes);
    if (texte) texte.textContent = texteRemerciement(type, d);
    const condoleances = $("[data-done-extra]", succes);
    if (condoleances) condoleances.hidden = d.ceremonie !== "funerailles";
    /* Référence mise en avant (audit UX) : reprise de la fin du message « (Réf. …) » */
    const blocRef = $("[data-done-ref]", succes);
    const reference = repli ? null : (/\(Réf\. ([^)]+)\)\s*$/.exec(message)?.[1] ?? null);
    if (blocRef) {
      const valeur = $("[data-done-ref-valeur]", blocRef);
      if (valeur) valeur.textContent = reference ?? "";
      blocRef.hidden = !reference;
    }
    const citation = $("[data-done-message]", succes);
    if (citation) citation.textContent = message;
    const lien = $<HTMLAnchorElement>("[data-done-wa]", succes);
    if (lien) lien.href = lienWhatsapp;
    const secours = $<HTMLTextAreaElement>(".done__fallback", succes);
    if (secours) {
      secours.value = message;
      secours.hidden = true;
    }
    if (alerte) alerte.hidden = !repli;
    $$(".rform__intro, .progress, .errors, .rstep", form).forEach((el) => {
      el.hidden = true;
    });
    form.classList.add("is-envoye");
    succes.hidden = false;
    $(".done__title", succes)?.focus();
  };

  const occupe = (oui: boolean) =>
    [envoi, reessai].forEach((b) => {
      if (!b) return;
      if (oui) b.setAttribute("aria-busy", "true");
      else b.removeAttribute("aria-busy");
    });

  /** Envoie la demande ; en cas d’échec, compose le message ici, sans référence. */
  const envoyer = async () => {
    if (enCours) return;
    enCours = true;
    occupe(true);
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), DELAI_ENVOI_MS);
    try {
      const reponse = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...valeurs(), ...source, formulaire: type, duree: Math.round(performance.now() - prepareLe), cle }),
        credentials: "same-origin",
        signal: arret.signal,
      });
      if (!reponse.ok) throw new Error(String(reponse.status));
      const r = (await reponse.json()) as { message?: unknown; lien?: unknown };
      if (typeof r.message !== "string" || typeof r.lien !== "string") throw new Error("réponse");
      terminer(r.message, r.lien, false);
    } catch {
      const message = composerMessage(type, valeurs());
      terminer(message, lienWa(ctx.wa, message), true);
    } finally {
      clearTimeout(minuteur);
      enCours = false;
      occupe(false);
    }
  };
  reessai?.addEventListener("click", () => void envoyer());

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
    else void envoyer();
  });

  $("[data-edit]", succes)?.addEventListener("click", () => {
    // La demande modifiée est une nouvelle demande.
    cle = nouvelleCle();
    succes.hidden = true;
    form.classList.remove("is-envoye");
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
