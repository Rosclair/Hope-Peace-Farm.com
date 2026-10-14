// Outils des tests de bout en bout : un navigateur Chrome partagé, des pages
// ouvertes avec les réglages de la maquette (format, heure figée à Douala).

import { randomInt } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";

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

/** Adresse de documentation (198.18.0.0/15, réservée aux essais), tirée au hasard. */
const adresseAuHasard = () => `198.${18 + randomInt(2)}.${randomInt(256)}.${randomInt(256)}`;

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
    // Un visiteur distinct par contexte pour la limite de 10 envois par heure et par
    // adresse : sans proxy devant lui (essai local), Next garde cet en-tête tel quel.
    extraHTTPHeaders: { "x-forwarded-for": adresseAuHasard() },
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

/** Remplit le numéro WhatsApp et coche l’accord à la dernière étape d’un formulaire. */
export async function remplirContact(f: Locator, prefixe: string, numero: string): Promise<void> {
  await f.locator(`#${prefixe}-whatsapp`).fill(numero);
  await f.locator('input[name="consentement"]').check();
}

/** Laisse passer le délai minimal de l’anti-spam (3 s après la préparation du formulaire). */
export async function attendreDelaiAntiSpam(page: Page): Promise<void> {
  await page.waitForTimeout(3200);
}

/**
 * Message attendu après un envoi enregistré : celui de la maquette suivi de la référence
 * lue dans le message affiché (elle est tirée au hasard par le serveur).
 */
export function avecReference(message: string, affiche: string): string {
  const reference = affiche.match(/\(Réf\. (HP-\d{6}-[2-9A-HJ-NP-Z]{6})\)$/)?.[1];
  if (!reference) throw new Error(`Message sans référence : ${affiche.slice(-60)}`);
  return `${message} (Réf. ${reference})`;
}

/**
 * Numéro WhatsApp neuf, tiré au hasard (la limite est de 3 demandes par jour et par
 * numéro) : 9 chiffres camerounais, éventuellement précédés d’un préfixe à écrire
 * tel quel (« +237 », « 00237 »…), ou numéro français (« +33 6 … ») pour la diaspora.
 */
export function numeroNeuf(forme: "cameroun" | "+237" | "france" = "cameroun"): string {
  const huit = String(randomInt(10 ** 8)).padStart(8, "0");
  if (forme === "france") return `+33 6 ${huit.replace(/(\d\d)(?=\d)/g, "$1 ")}`;
  return `${forme === "+237" ? "+237 " : ""}6${huit}`;
}
