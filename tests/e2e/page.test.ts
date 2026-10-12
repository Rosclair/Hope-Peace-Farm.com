// Comportements de la page publique, comparés à ceux de la maquette
// (reference/extrait/principal.js). La parité visuelle et celle du DOM sont
// contrôlées à part : npm run site:parite.

import { AxeBuilder } from "@axe-core/playwright";
import { afterAll, describe, expect, it } from "vitest";
import { composerMessage, lienWa, texteRemerciement } from "@/lib/whatsapp/messages";
import { fermer, lancer, ouvrir, SITE } from "./outils";

afterAll(fermer);

const NBSP = " ";

describe("chargement", () => {
  it("pose les classes du script de tête et démarre le moteur sans erreur ni avertissement", async () => {
    const { contexte, page, erreurs } = await ouvrir();
    const classes = await page.evaluate(() => document.documentElement.className);
    expect(classes).toMatch(/\bjs\b/);
    expect(classes).toMatch(/\bmotion\b/);
    expect(classes).toMatch(/\bscrolly\b/);
    expect(classes).toMatch(/\bfetes-garanti\b/);
    expect(classes).toMatch(/\breveal-on\b/);
    expect(classes).not.toMatch(/no-js/);
    await page.waitForTimeout(500);
    expect(erreurs).toEqual([]);
    await contexte.close();
  });

  it("charge les trois polices de la maquette", async () => {
    const { contexte, page } = await ouvrir();
    const polices = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`),
    );
    expect(polices).toEqual(expect.arrayContaining(["policeTitre 800", "policeTexte 400", "policeTexte 600"]));
    await contexte.close();
  });

  it("ne charge aucune ressource tierce", async () => {
    const { contexte } = await ouvrir();
    const page = await contexte.newPage();
    const hotes = new Set<string>();
    page.on("request", (r) => hotes.add(new URL(r.url()).host));
    await page.goto(SITE, { waitUntil: "networkidle" });
    expect([...hotes]).toEqual([new URL(SITE).host]);
    await contexte.close();
  });
});

describe("moteur immédiat (sans attendre le JavaScript de Next.js)", () => {
  it("landing, apparitions, menu et barre fixe fonctionnent même si Next.js ne se charge jamais", async () => {
    const b = await lancer();
    const contexte = await b.newContext({ viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true });
    const page = await contexte.newPage();
    await page.route("**/_next/static/chunks/*.js", (r) => r.abort());
    await page.goto(SITE, { waitUntil: "load" });
    expect(await page.evaluate(() => document.documentElement.className)).toMatch(/\breveal-on\b/);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(400);
    expect(Number(await page.evaluate(() => document.documentElement.style.getPropertyValue("--dock")))).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click(".menu__toggle");
    expect(await page.evaluate(() => document.querySelector("main")!.hasAttribute("inert"))).toBe(true);
    expect(await page.locator(".bar").getAttribute("class")).toContain("is-ready");
    await contexte.close();
  });
});

describe("menu mobile", () => {
  it("rend le reste de la page inerte, se ferme par Échap et rend le focus au bouton", async () => {
    const { contexte, page } = await ouvrir();
    // L’évènement « toggle » de <details> est asynchrone : on attend l’état d’inertie.
    const inerte = (attendu: boolean) =>
      page.waitForFunction((v) => document.querySelector("main")!.hasAttribute("inert") === v, attendu, { timeout: 2000 });
    await page.click(".menu__toggle");
    expect(await page.evaluate(() => (document.querySelector(".menu") as HTMLDetailsElement).open)).toBe(true);
    await inerte(true);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (document.querySelector(".menu") as HTMLDetailsElement).open)).toBe(false);
    await inerte(false);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("menu__toggle"))).toBe(true);
    await contexte.close();
  });

  it("se ferme au choix d’un lien et mène à la section", async () => {
    const { contexte, page } = await ouvrir();
    await page.click(".menu__toggle");
    await page.click('.menu__link[href="#livraison"]');
    expect(await page.evaluate(() => (document.querySelector(".menu") as HTMLDetailsElement).open)).toBe(false);
    expect(new URL(page.url()).hash).toBe("#livraison");
    await contexte.close();
  });
});

describe("ancres et historique", () => {
  it("un lien vers #devis choisit le formulaire Cérémonie ; le retour arrière ne recharge pas la page", async () => {
    const { contexte, page } = await ouvrir();
    await page.evaluate(() => ((window as unknown as { __temoin: number }).__temoin = 42));
    // Bouton « Commander » de l’en-tête (poulets ; masqué sur mobile, cliqué par script),
    // puis « Préparer ma cérémonie » (cérémonie)
    await page.evaluate(() => (document.querySelector("a.nav__cta") as HTMLAnchorElement).click());
    expect(await page.locator('input[name="type-demande"][value="poulets"]').isChecked()).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('.hero__actions a[href="#devis"]');
    expect(new URL(page.url()).hash).toBe("#devis");
    expect(await page.locator('input[name="type-demande"][value="ceremonie"]').isChecked()).toBe(true);
    await page.goBack();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __temoin?: number }).__temoin)).toBe(42);
    await contexte.close();
  });

  it("ouvrir l’adresse #essai prépare le formulaire Pro", async () => {
    const { contexte, page } = await ouvrir({ chemin: "/#essai" });
    expect(await page.locator('input[name="type-demande"][value="pro"]').isChecked()).toBe(true);
    expect(await page.locator('form[data-form="pro"]').evaluate((f) => f.classList.contains("is-current"))).toBe(true);
    await contexte.close();
  });

  it("ouvrir l’adresse #confidentialite déplie le bloc", async () => {
    const { contexte, page } = await ouvrir({ chemin: "/#confidentialite" });
    expect(await page.evaluate(() => (document.getElementById("confidentialite") as HTMLDetailsElement).open)).toBe(true);
    await contexte.close();
  });

  it("le lien « Confidentialité » du formulaire déplie le bloc", async () => {
    const { contexte, page } = await ouvrir();
    await page.locator(".request__privacy a").click();
    expect(await page.evaluate(() => (document.getElementById("confidentialite") as HTMLDetailsElement).open)).toBe(true);
    await contexte.close();
  });
});

describe("Fêtes selon la date (heure de Douala)", () => {
  const cas = [
    ["2026-10-15T09:00:00Z", "fetes-garanti", "(prix garanti avant le 1er novembre 2026)"],
    ["2026-11-15T09:00:00Z", "", ""],
    ["2026-12-21T09:00:00Z", "fetes-fin", ""],
  ] as const;
  it.each(cas)("le %s", async (heure, classe, garantie) => {
    const { contexte, page } = await ouvrir({ heure });
    const classes = await page.evaluate(() => document.documentElement.className);
    if (classe) expect(classes).toContain(classe);
    expect(classes.includes("fetes-garanti")).toBe(classe === "fetes-garanti");
    expect(classes.includes("fetes-fin")).toBe(classe === "fetes-fin");
    const lien = decodeURIComponent((await page.locator("#fetes-reserver").getAttribute("href")) ?? "");
    expect(lien.includes(garantie)).toBe(true);
    if (!garantie) expect(lien).toContain("pour les fêtes.");
    const bandeauVisible = await page.locator(".banner").isVisible();
    expect(bandeauVisible).toBe(classe !== "fetes-fin");
    await contexte.close();
  });
});

describe("formulaires", () => {
  it("Cérémonie : erreurs, deux étapes, message de la maquette, condoléances, copie, modification", async () => {
    const { contexte, page } = await ouvrir();
    await contexte.grantPermissions(["clipboard-read", "clipboard-write"]);
    const f = page.locator('form[data-form="ceremonie"]');
    await f.scrollIntoViewIfNeeded();
    await f.locator("[data-next]").click();
    const resume = await f.locator(".errors").innerText();
    expect(resume).toContain(`Type de cérémonie${NBSP}: Ce champ est nécessaire pour préparer votre devis.`);
    expect(await f.locator('.field[data-field="lieu"] .field__error').isVisible()).toBe(true);
    expect(await f.locator("#c-lieu").getAttribute("aria-invalid")).toBe("true");
    // Bornes des dates : aujourd’hui à Douala, et dans un an
    expect(await f.locator("#c-date").getAttribute("min")).toBe("2026-10-11");
    expect(await f.locator("#c-date").getAttribute("max")).toBe("2027-10-11");

    await f.locator('label.chip:has(input[value="funerailles"])').click();
    await f.locator("#c-date").fill("2026-12-19");
    await f.locator("#c-lieu").fill("Bazou, chefferie, près du marché");
    await f.locator('label.chip:has(input[value="100 à 200"])').click();
    expect(await f.locator('.field[data-field="lieu"] .field__error').isVisible()).toBe(false);
    await f.locator("[data-next]").click();
    expect(await f.locator("[data-step-now]").innerText()).toBe("2");
    await f.locator("#c-nom").fill("Exemple Test");
    await f.locator("#c-residence").fill("Douala");
    await f.locator('button[type="submit"]').click();

    const reponses = {
      ceremonie: "funerailles",
      date: "2026-12-19",
      lieu: "Bazou, chefferie, près du marché",
      invites: "100 à 200",
      nom: "Exemple Test",
      residence: "Douala",
    };
    const attendu = composerMessage("ceremonie", reponses);
    expect(await f.locator("[data-done-message]").innerText()).toBe(attendu);
    expect(await f.locator("[data-done-wa]").getAttribute("href")).toBe(lienWa("237693645565", attendu));
    expect(await f.locator("[data-done-text]").innerText()).toBe(texteRemerciement("ceremonie", reponses));
    expect(await f.locator("[data-done-extra]").isVisible()).toBe(true);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("done__title"))).toBe(true);

    await f.locator("[data-copy]").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(attendu);
    expect(await f.locator("[data-copy] span").innerText()).toBe("Message copié");

    await f.locator("[data-edit]").click();
    expect(await f.locator(".done").isVisible()).toBe(false);
    expect(await f.locator('.rstep[data-step="1"]').isVisible()).toBe(true);
    expect(await f.locator("#c-lieu").inputValue()).toBe("Bazou, chefferie, près du marché");
    await contexte.close();
  });

  it("Poulets : compteur, lieu exigé seulement en livraison, brouillon gardé au rechargement", async () => {
    const { contexte, page } = await ouvrir({ chemin: "/#commande" });
    const f = page.locator('form[data-form="poulets"]');
    expect(await f.evaluate((el) => el.classList.contains("is-current"))).toBe(true);
    const plus = f.locator('[data-count="1"]');
    if (await plus.isVisible()) {
      await plus.click();
      await plus.click();
      expect(await f.locator("#p-nombre").inputValue()).toBe("2");
    }
    await f.locator("#p-nombre").fill("25");
    await f.locator('label.chip:has(input[value="sauce"])').click();
    await f.locator("#p-date").fill("2026-10-20");
    await f.locator("[data-next]").click();
    await f.locator('label.chip:has(input[value="livraison"])').click();
    await f.locator("#p-nom").fill("Awa");
    await f.locator('button[type="submit"]').click();
    expect(await f.locator(".errors").innerText()).toContain(
      `Lieu de livraison${NBSP}: Ce champ est nécessaire pour préparer votre commande.`,
    );
    await f.locator("#p-lieu").fill("Douala, Bonapriso");

    // Le brouillon survit au rechargement (sessionStorage), comme dans la maquette.
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".bar.is-ready", { state: "attached" });
    await page.locator('form[data-form="poulets"]').scrollIntoViewIfNeeded();
    const g = page.locator('form[data-form="poulets"]');
    expect(await page.locator('input[name="type-demande"][value="poulets"]').isChecked()).toBe(true);
    expect(await g.locator("#p-nombre").inputValue()).toBe("25");
    expect(await g.locator("#p-lieu").inputValue()).toBe("Douala, Bonapriso");
    await g.locator("[data-next]").click();
    await g.locator('button[type="submit"]').click();
    const attendu = composerMessage("poulets", {
      nombre: "25",
      preparation: "sauce",
      date: "2026-10-20",
      reception: "livraison",
      lieu: "Douala, Bonapriso",
      nom: "Awa",
      precisions: "",
    });
    expect(await g.locator("[data-done-message]").innerText()).toBe(attendu);
    await contexte.close();
  });

  it("Pro : message et remerciement de la maquette, case des annonces", async () => {
    const { contexte, page } = await ouvrir({ chemin: "/#essai" });
    const f = page.locator('form[data-form="pro"]');
    await f.locator("#e-nom").fill("Chez Mama");
    await f.locator('label.chip:has(input[value="restaurant"])').click();
    await f.locator("#e-ville").fill("Bafoussam");
    await f.locator("[data-next]").click();
    await f.locator('label.chip:has(input[value="10 à 30"])').click();
    await f.locator('label.chip:has(input[value="prêts à cuire"])').click();
    await f.locator("#e-contact").fill("Mama, gérante");
    await f.locator("details.more summary").click();
    await f.locator("#e-precisions").fill("Livraison le lundi");
    await f.locator('button[type="submit"]').click();
    const reponses = {
      etablissement: "Chez Mama",
      type: "restaurant",
      ville: "Bafoussam",
      volume: "10 à 30",
      preparation: "prêts à cuire",
      contact: "Mama, gérante",
      precisions: "Livraison le lundi",
    };
    expect(await f.locator("[data-done-message]").innerText()).toBe(composerMessage("pro", reponses));
    expect(await f.locator("[data-done-text]").innerText()).toBe(texteRemerciement("pro", reponses));
    await contexte.close();
  });
});

describe("barre fixe", () => {
  it("masquée sur l’accueil (bouton principal visible), visible plus bas, masquée pendant la saisie", async () => {
    const { contexte, page } = await ouvrir({ reduit: true });
    const masquee = () => page.evaluate(() => document.querySelector(".bar")!.classList.contains("is-hidden"));
    expect(await masquee()).toBe(true);
    await page.evaluate(() => document.getElementById("la-ferme")!.scrollIntoView());
    await page.waitForTimeout(300);
    expect(await masquee()).toBe(false);
    await page.evaluate(() => (document.getElementById("c-lieu") as HTMLInputElement).focus({ preventScroll: true }));
    await page.waitForTimeout(150);
    expect(await masquee()).toBe(true);
    await contexte.close();
  });
});

describe("accessibilité (axe-core, WCAG 2.2 A et AA)", () => {
  it.each([393, 1280])("aucune violation à %i px, comme la maquette", async (largeur) => {
    const { contexte, page } = await ouvrir({ largeur, hauteur: largeur < 1024 ? 780 : 800 });
    // Fin des apparitions (fondus de « Comment ça marche » : jusqu’à ~1,5 s) : mesuré en
    // plein fondu, le contraste est insuffisant, sur la maquette comme sur le site.
    await page.waitForTimeout(2000);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(r.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    await contexte.close();
  });
});

describe("sans JavaScript", () => {
  it("la page se lit, le menu s’ouvre et le message de repli du formulaire s’affiche", async () => {
    const { contexte, page } = await ouvrir({ js: false });
    expect(await page.evaluate(() => document.documentElement.className)).toMatch(/\bno-js\b/);
    expect(await page.locator(".hero__title").innerText()).toContain("Vous êtes loin.");
    await page.click(".menu__toggle");
    expect(await page.locator(".menu__panel").isVisible()).toBe(true);
    expect(await page.locator(".noscript").innerText()).toContain("Le formulaire a besoin de JavaScript.");
    await contexte.close();
  });
});
