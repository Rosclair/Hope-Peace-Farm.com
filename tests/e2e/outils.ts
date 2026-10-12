// Outils des tests de bout en bout : un navigateur Chrome partagé, des pages
// ouvertes avec les réglages de la maquette (format, heure figée à Douala).

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export const SITE = process.env.HPF_SITE_URL ?? "http://127.0.0.1:3100";

/** 11 octobre 2026, 10 h à Douala : réservations des Fêtes, prix garanti. */
export const HEURE_REFERENCE = "2026-10-11T09:00:00Z";

let navigateur: Browser | undefined;

export async function lancer(): Promise<Browser> {
  navigateur ??= await chromium.launch({ channel: "chrome", headless: true });
  return navigateur;
}

export async function fermer(): Promise<void> {
  await navigateur?.close();
  navigateur = undefined;
}

export interface Ouverture {
  contexte: BrowserContext;
  page: Page;
  /** Erreurs et avertissements de la console, erreurs de la page. */
  erreurs: string[];
}

export async function ouvrir(
  options: {
    chemin?: string;
    largeur?: number;
    hauteur?: number;
    js?: boolean;
    reduit?: boolean;
    heure?: string;
    /**
     * Retire de la réponse les classes des Fêtes posées par le serveur (date réelle) :
     * seul le script de tête décide, à l’heure simulée du navigateur.
     */
    sansFetesServeur?: boolean;
  } = {},
): Promise<Ouverture> {
  const { chemin = "/", largeur = 393, hauteur = 780, js = true, reduit = false, heure = HEURE_REFERENCE, sansFetesServeur = false } = options;
  const b = await lancer();
  const contexte = await b.newContext({
    viewport: { width: largeur, height: hauteur },
    isMobile: largeur < 1024,
    hasTouch: largeur < 1024,
    javaScriptEnabled: js,
    reducedMotion: reduit ? "reduce" : "no-preference",
    locale: "fr-CM",
    timezoneId: "Africa/Douala",
  });
  const page = await contexte.newPage();
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") erreurs.push(`${m.type()} : ${m.text()}`);
  });
  if (js) await page.clock.setFixedTime(new Date(heure));
  if (sansFetesServeur) {
    await page.route(new URL(chemin, SITE).href, async (route) => {
      const reponse = await route.fetch();
      const corps = (await reponse.text()).replace(/(<html[^>]*class="[^"]*?) fetes-(?:garanti|fin)/, "$1");
      await route.fulfill({ response: reponse, body: corps });
    });
  }
  await page.goto(new URL(chemin, SITE).href, { waitUntil: "load" });
  if (js) {
    await page.evaluate(() => document.fonts.ready);
    // Le moteur immédiat a démarré : la barre fixe devient « prête ».
    await page.waitForSelector(".bar.is-ready", { state: "attached" });
  }
  return { contexte, page, erreurs };
}
