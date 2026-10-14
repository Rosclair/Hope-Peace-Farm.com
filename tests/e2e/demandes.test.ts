// Envoi des demandes de bout en bout (phase 4), contre le serveur qui tourne sur la
// base de test, avec le Mailpit dédié pour les e-mails :
//   DB_NAME=hpf_test PORT=3100 npm run standalone
//   mailpit --smtp 127.0.0.1:1026 --listen 127.0.0.1:8026 … (voir CLAUDE.md)
// Chaque test utilise un numéro WhatsApp tiré au hasard, retrouvé ensuite en base.

import { AxeBuilder } from "@axe-core/playwright";
import { desc, eq } from "drizzle-orm";
import type { Locator, Page } from "playwright";
import { afterAll, describe, expect, it } from "vitest";
import { base, db } from "@/lib/db/client";
import { demande } from "@/lib/db/schema";
import { normaliserNumero } from "@/lib/demandes/numero";
import { composerMessage, lienWa } from "@/lib/whatsapp/messages";
import { attendreDelaiAntiSpam, avecReference, fermer, lancer, numeroNeuf, ouvrir, remplirContact, SITE } from "./outils";

const MAILPIT = process.env.HPF_MAILPIT_URL ?? "http://127.0.0.1:8026";
const BASE_DE_TEST = (process.env.DB_NAME ?? "").endsWith("_test");

afterAll(async () => {
  await fermer();
  await base().pool.end();
});

const demandesDu = (numero: string) =>
  db()
    .select()
    .from(demande)
    .where(eq(demande.whatsappE164, normaliserNumero(numero)!))
    .orderBy(desc(demande.id));

/** Formulaire Poulets rempli jusqu’au bouton d’envoi (retrait à la ferme). */
async function remplirPoulets(page: Page, numero: string): Promise<Locator> {
  const f = page.locator('form[data-form="poulets"]');
  await f.locator("#p-nombre").fill("12");
  await f.locator('label.chip:has(input[value="pret"])').click();
  await f.locator("#p-date").fill("2026-11-20");
  await f.locator("[data-next]").click();
  await f.locator('label.chip:has(input[value="retrait"])').click();
  await f.locator("#p-nom").fill("Client E2E");
  await remplirContact(f, "p", numero);
  await attendreDelaiAntiSpam(page);
  return f;
}
const MESSAGE_POULETS = composerMessage("poulets", {
  nombre: "12",
  preparation: "pret",
  date: "2026-11-20",
  reception: "retrait",
  nom: "Client E2E",
});

/** Violations axe-core d’une adresse, analysée avec JavaScript (axe ne s’exécute pas sans lui). */
async function violationsAxe(url: string): Promise<string[]> {
  const contexte = await (await lancer()).newContext({ viewport: { width: 393, height: 780 }, locale: "fr-CM" });
  const page = await contexte.newPage();
  await page.goto(url, { waitUntil: "load" });
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  await contexte.close();
  return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
}

/** E-mail reçu par Mailpit dont le sujet contient `texte` (attend jusqu’à 10 s). */
async function emailRecu(texte: string): Promise<{ Subject: string } | undefined> {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${texte}"`)}`).catch(() => null);
    if (!r?.ok) throw new Error(`Mailpit injoignable (${MAILPIT}) : lancer le Mailpit dédié (CLAUDE.md)`);
    const j = (await r.json()) as { messages: { Subject: string }[] };
    if (j.messages.length) return j.messages[0];
    await new Promise((ok) => setTimeout(ok, 500));
  }
  return undefined;
}

describe.runIf(BASE_DE_TEST)("avec JavaScript", () => {
  it("enregistre la demande, affiche le message suivi de la référence et prévient le propriétaire par e-mail", async () => {
    const numero = numeroNeuf();
    const { contexte, page, erreurs } = await ouvrir({ chemin: "/?src=flyer-e2e&utm_source=facebook#commande" });
    const f = await remplirPoulets(page, numero);
    await f.locator('button[type="submit"]').click();
    await f.locator(".done").waitFor();

    const message = await f.locator("[data-done-message]").innerText();
    expect(message).toBe(avecReference(MESSAGE_POULETS, message));
    expect(await f.locator("[data-done-wa]").getAttribute("href")).toBe(lienWa("237693645565", message));
    expect(await f.locator("[data-done-wa]").getAttribute("target")).toBe("_blank");
    expect(page.url()).toContain(SITE); // WhatsApp ne s’ouvre jamais tout seul
    expect(contexte.pages()).toHaveLength(1);

    const [d] = await demandesDu(numero);
    expect(d).toMatchObject({ type: "poulets", modeEnvoi: "js", sourceCode: "flyer-e2e", utmSource: "facebook", message });
    expect(message.endsWith(`(Réf. ${d!.reference})`)).toBe(true);
    expect((await emailRecu(d!.reference))?.Subject).toBe(`Nouvelle demande Poulets — ${d!.reference}`);
    expect(erreurs).toEqual([]);
    await contexte.close();
  });

  it("sans réseau : message composé par le navigateur, saisie gardée, puis « Réessayer » enregistre", async () => {
    const numero = numeroNeuf();
    const { contexte, page } = await ouvrir({ chemin: "/#commande" });
    await page.route("**/api/demandes", (route) => route.abort("internetdisconnected"));
    const f = await remplirPoulets(page, numero);
    await f.locator('button[type="submit"]').click();
    await f.locator(".done").waitFor();

    expect(await f.locator("[data-done-erreur]").isVisible()).toBe(true);
    expect(await f.locator("[data-done-message]").innerText()).toBe(MESSAGE_POULETS);
    expect(await f.locator("[data-done-wa]").getAttribute("href")).toBe(lienWa("237693645565", MESSAGE_POULETS));
    expect(await demandesDu(numero)).toHaveLength(0);
    // Saisie gardée : brouillon de la visite
    const brouillon = await page.evaluate(() => JSON.parse(sessionStorage.getItem("hpf-form-poulets") ?? "{}"));
    expect(brouillon).toMatchObject({ nom: "Client E2E", whatsapp: numero });
    const axe = await new AxeBuilder({ page }).include(".request__card").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);

    await page.unroute("**/api/demandes");
    await f.locator("[data-retry]").click();
    await f.locator("[data-done-erreur]").waitFor({ state: "hidden" });
    const message = await f.locator("[data-done-message]").innerText();
    expect(message).toBe(avecReference(MESSAGE_POULETS, message));
    expect(await demandesDu(numero)).toHaveLength(1);
    await contexte.close();
  });

  it("réponse perdue après l’enregistrement : « Réessayer » retrouve la même demande, sans doublon", async () => {
    const numero = numeroNeuf();
    const { contexte, page } = await ouvrir({ chemin: "/#commande" });
    await page.route("**/api/demandes", async (route) => {
      await route.fetch(); // la demande arrive au serveur…
      await route.abort("connectionreset"); // …mais la réponse se perd
    });
    const f = await remplirPoulets(page, numero);
    await f.locator('button[type="submit"]').click();
    await f.locator(".done").waitFor();
    expect(await f.locator("[data-done-erreur]").isVisible()).toBe(true);
    const [premiere] = await demandesDu(numero);
    expect(premiere).toBeDefined();

    await page.unroute("**/api/demandes");
    await f.locator("[data-retry]").click();
    await f.locator("[data-done-erreur]").waitFor({ state: "hidden" });
    expect(await f.locator("[data-done-message]").innerText()).toBe(premiere!.message);
    expect(await demandesDu(numero)).toHaveLength(1);
    await contexte.close();
  });

  it("champ piège rempli : succès affiché, rien d’enregistré", async () => {
    const numero = numeroNeuf();
    const { contexte, page } = await ouvrir({ chemin: "/#commande" });
    const f = await remplirPoulets(page, numero);
    await f.locator('input[name="site_web"]').evaluate((el: HTMLInputElement) => {
      el.value = "http://robot.example";
    });
    await f.locator('button[type="submit"]').click();
    await f.locator(".done").waitFor();
    expect(await f.locator("[data-done-message]").innerText()).toBe(MESSAGE_POULETS);
    expect(await demandesDu(numero)).toHaveLength(0);
    await contexte.close();
  });

  it("refuse une requête venue d’un autre site", async () => {
    const r = await fetch(new URL("/api/demandes", SITE), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://exemple.com" },
      body: "{}",
    });
    expect(r.status).toBe(403);
  });
});

describe.runIf(BASE_DE_TEST)("sans JavaScript", () => {
  it("Cérémonie : envoi, page de confirmation avec la référence et le bouton WhatsApp", async () => {
    const numero = numeroNeuf();
    const { contexte, page } = await ouvrir({ js: false });
    const f = page.locator('form[data-form="ceremonie"]');
    await f.locator('label.chip:has(input[value="mariage"])').click();
    await f.locator('input[name="date_inconnue"]').check();
    await f.locator("#c-lieu").fill("Bangangté, centre");
    await f.locator('label.chip:has(input[value="plus de 400"])').click();
    await f.locator("#c-nom").fill("Client Sans JS");
    await f.locator("#c-residence").fill("Paris");
    await remplirContact(f, "c", numero);
    await Promise.all([page.waitForURL(/\/demande\/confirmation\?d=/), f.locator('button[type="submit"]').click()]);

    expect(page.url()).not.toContain(numero.slice(-4));
    const [d] = await demandesDu(numero);
    expect(d).toMatchObject({ type: "ceremonie", modeEnvoi: "sans_js" });
    const attendu = `${composerMessage("ceremonie", {
      ceremonie: "mariage",
      date_inconnue: "1",
      lieu: "Bangangté, centre",
      invites: "plus de 400",
      nom: "Client Sans JS",
      residence: "Paris",
    })} (Réf. ${d!.reference})`;
    expect(await page.locator(".done__message").innerText()).toBe(attendu);
    expect(await page.locator(".done__actions a").getAttribute("href")).toBe(lienWa("237693645565", attendu));
    expect(await page.locator(".done__help").innerText()).toContain(d!.reference);
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
    expect(await violationsAxe(page.url())).toEqual([]);
    await contexte.close();
  });

  it("Poulets (onglet choisi sans JavaScript, livraison) et Pro : enregistrés", async () => {
    const numero = numeroNeuf();
    const { contexte, page } = await ouvrir({ js: false });
    await page.locator('label.tab:has(input[value="poulets"])').click();
    const f = page.locator('form[data-form="poulets"]');
    await f.locator("#p-nombre").fill("40");
    await f.locator('label.chip:has(input[value="braise"])').click();
    await f.locator("#p-date").fill("2026-12-24");
    await f.locator('label.chip:has(input[value="livraison"])').click();
    await f.locator("#p-lieu").fill("Bafoussam, Tamdja");
    await f.locator("#p-nom").fill("Client Poulets");
    await remplirContact(f, "p", numero);
    await Promise.all([page.waitForURL(/\/demande\/confirmation\?d=/), f.locator('button[type="submit"]').click()]);
    expect(await page.locator(".done__message").innerText()).toContain("40 poulets découpés pour la braise");

    await page.goto(new URL("/", SITE).href);
    await page.locator('label.tab:has(input[value="pro"])').click();
    const g = page.locator('form[data-form="pro"]');
    await g.locator("#e-nom").fill("Snack E2E");
    await g.locator('label.chip:has(input[value="snack ou braiseur"])').click();
    await g.locator("#e-ville").fill("Bangangté");
    await g.locator('label.chip:has(input[value="plus de 60"])').click();
    await g.locator('label.chip:has(input[value="découpés"])').click();
    await g.locator("#e-contact").fill("Gérant");
    await remplirContact(g, "e", numero);
    await Promise.all([page.waitForURL(/\/demande\/confirmation\?d=/), g.locator('button[type="submit"]').click()]);

    const demandes = await demandesDu(numero);
    expect(demandes.map((d) => [d.type, d.modeEnvoi])).toEqual([
      ["pro", "sans_js"],
      ["poulets", "sans_js"],
    ]);
    expect(demandes[1]!.reponses).toMatchObject({ reception: "livraison", lieu: "Bafoussam, Tamdja" });
    await contexte.close();
  });

  it("champs manquants : la page dit lesquels corriger, rien n’est enregistré", async () => {
    const numero = numeroNeuf();
    const { contexte, page } = await ouvrir({ js: false });
    const f = page.locator('form[data-form="ceremonie"]');
    await f.locator("#c-whatsapp").fill(numero);
    await Promise.all([page.waitForURL(/erreur=validation/), f.locator('button[type="submit"]').click()]);
    const liste = await page.locator(".confirmation__liste").innerText();
    expect(liste).toContain("Type de cérémonie");
    expect(liste).toContain("Accord pour être contacté sur WhatsApp");
    expect(liste).not.toContain("Numéro WhatsApp");
    expect(await demandesDu(numero)).toHaveLength(0);
    expect(await violationsAxe(page.url())).toEqual([]);
    await contexte.close();
  });
});
