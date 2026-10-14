// Back-office de bout en bout (brief §6) : connexion avec TOTP (code calculé par le
// test à partir de la clé affichée), verrouillage, demandes (statut, note, export),
// contenus (enregistrement, champ sensible, publication qui met la page à jour),
// rôles, sans JavaScript, axe-core. Le serveur testé tourne sur la base de test :
//   DB_NAME=hpf_test PORT=3100 npm run standalone

import { randomBytes, randomInt } from "node:crypto";
import { AxeBuilder } from "@axe-core/playwright";
import { eq } from "drizzle-orm";
import type { BrowserContext, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerCompte } from "@/lib/auth/comptes";
import { enregistrerBrouillon, initialiserSiVide, lireBrouillon, lireVersionEnLigne, publier } from "@/lib/contenu/depot";
import { empreinteContenu } from "@/lib/contenu/empreinte";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import { base, db } from "@/lib/db/client";
import { demande, journalAudit, utilisateur } from "@/lib/db/schema";
import { isoDouala } from "@/lib/demandes/schema";
import { fermer, lancer, SITE } from "./outils";
import { codeTotp } from "./totp";

const BASE_DE_TEST = (process.env.DB_NAME ?? "").endsWith("_test");
const NBSP = " ";
const MOT_DE_PASSE = "une phrase assez longue 2026";
const suffixe = randomBytes(4).toString("hex");
const adresse = () => `198.18.${randomInt(256)}.${randomInt(256)}`;

interface Session {
  contexte: BrowserContext;
  page: Page;
  cle: string;
}

async function contexte(js = true) {
  const b = await lancer();
  const c = await b.newContext({ viewport: { width: 393, height: 800 }, isMobile: true, hasTouch: true, javaScriptEnabled: js, locale: "fr-CM", extraHTTPHeaders: { "x-forwarded-for": adresse() } });
  return { contexte: c, page: await c.newPage() };
}

async function motDePasse(page: Page, email: string, mdp = MOT_DE_PASSE) {
  await page.goto(new URL("/admin/connexion", SITE).href);
  await page.fill("#email", email);
  await page.fill("#motDePasse", mdp);
  await page.click("button[type=submit]");
}

/** Première connexion : mot de passe, activation du second facteur (QR code, codes, premier code). */
async function premiereConnexion(email: string): Promise<Session & { codes: string[] }> {
  const { contexte: c, page } = await contexte();
  await motDePasse(page, email);
  await page.waitForURL(/\/admin\/securite\/activer$/);
  await page.fill("#motDePasse", MOT_DE_PASSE);
  await page.click("button[type=submit]");
  const cle = (await page.locator("code").first().innerText()).trim();
  const codes = await page.locator(".codes li").allInnerTexts();
  expect(await page.locator(".qr svg").count()).toBe(1);
  await page.fill("#code", codeTotp(cle));
  await page.click("text=Activer et continuer");
  await page.waitForURL(/\/admin\?bienvenue=1$/);
  return { contexte: c, page, cle, codes };
}

async function connexion(email: string, cle: string): Promise<Session> {
  const { contexte: c, page } = await contexte();
  await motDePasse(page, email);
  await page.waitForURL(/\/admin\/connexion\/code$/);
  await page.fill("#code", codeTotp(cle));
  await page.click("button[type=submit]");
  await page.waitForURL(new URL("/admin", SITE).href);
  return { contexte: c, page, cle };
}

async function violations(page: Page, chemin: string): Promise<string[]> {
  await page.goto(new URL(chemin, SITE).href);
  // Le contenu de la page arrive en flux, après la coquille (Suspense).
  await page.waitForSelector("main h1");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  return r.violations.map((v) => `${chemin} : ${v.id} (${v.nodes.length})`);
}

/** Envoie une demande Poulets par l’API publique ; renvoie sa référence. */
async function nouvelleDemande(nom: string): Promise<string> {
  const r = await fetch(new URL("/api/demandes", SITE), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": adresse() },
    body: JSON.stringify({
      formulaire: "poulets",
      duree: 5000,
      cle: randomBytes(12).toString("hex"),
      nombre: "4",
      preparation: "pret",
      date: isoDouala(12),
      reception: "retrait",
      nom,
      whatsapp: `6${String(randomInt(10 ** 8)).padStart(8, "0")}`,
      consentement: "1",
      src: "flyer",
    }),
  });
  expect(r.status).toBe(201);
  return ((await r.json()) as { reference: string }).reference;
}

const pagePublique = async () => (await fetch(new URL("/", SITE), { cache: "no-store" })).text();

describe.skipIf(!BASE_DE_TEST)("back-office (base de test)", () => {
  const proprio = `proprio-${suffixe}@hpf.test`;
  const equipe = `equipe-${suffixe}@hpf.test`;
  const verrou = `verrou-${suffixe}@hpf.test`;
  let p: Session;

  beforeAll(async () => {
    await initialiserSiVide("test e2e");
    // Contenu de la maquette en ligne et dans le brouillon.
    const b = await lireBrouillon();
    const v = await lireVersionEnLigne();
    if (b && empreinteContenu(b.donnees) !== empreinteContenu(CONTENU_INITIAL)) {
      await enregistrerBrouillon({ donnees: structuredClone(CONTENU_INITIAL), aConfirmer: b.aConfirmer, revisionAttendue: b.revision, par: "test e2e" });
    }
    if (v?.empreinte !== empreinteContenu(CONTENU_INITIAL)) await publier({ par: "test e2e" });
    await creerCompte({ email: proprio, nom: "Propriétaire Test", role: "proprietaire", motDePasse: MOT_DE_PASSE });
    await creerCompte({ email: equipe, nom: "Équipe Test", role: "equipe", motDePasse: MOT_DE_PASSE });
    await creerCompte({ email: verrou, nom: "Verrou Test", role: "equipe", motDePasse: MOT_DE_PASSE });
  });

  afterAll(async () => {
    await p?.contexte.close();
    await fermer();
    await base().pool.end();
  });

  it("sans session, toute page du back-office mène à la connexion (avec et sans JavaScript)", async () => {
    for (const js of [true, false]) {
      const { contexte: c, page } = await contexte(js);
      await page.goto(new URL("/admin/contenus", SITE).href);
      await page.waitForURL(/\/admin\/connexion$/, { timeout: 10_000 });
      await c.close();
    }
    // Redirection HTTP (proxy), utile sans JavaScript ; la route refuse aussi d’elle-même.
    const r = await fetch(new URL("/admin/demandes/export", SITE), { redirect: "manual" });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toMatch(/\/admin\/connexion$/);
  });

  it("première connexion : activation du TOTP obligatoire, puis connexion en deux temps", async () => {
    const premiere = await premiereConnexion(proprio);
    expect(premiere.codes).toHaveLength(10);
    await premiere.page.click("text=Se déconnecter");
    await premiere.page.waitForURL(/\/admin\/connexion$/);
    await premiere.contexte.close();

    // Mauvais code, puis bon code.
    const { contexte: c, page } = await contexte();
    await motDePasse(page, proprio);
    await page.waitForURL(/\/admin\/connexion\/code$/);
    await page.fill("#code", "000000");
    await page.click("button[type=submit]");
    await expect.poll(() => page.locator(".message[role=alert]").innerText()).toContain("Code incorrect");
    await page.fill("#code", codeTotp(premiere.cle));
    await page.click("button[type=submit]");
    await page.waitForURL(new URL("/admin", SITE).href);
    await c.close();

    // Code de secours (usage unique).
    const s = await contexte();
    await motDePasse(s.page, proprio);
    await s.page.waitForURL(/\/admin\/connexion\/code$/);
    await s.page.fill("#code", premiere.codes[0]!);
    await s.page.click("button[type=submit]");
    await s.page.waitForURL(new URL("/admin", SITE).href);
    await s.contexte.close();

    // Sans JavaScript : mêmes formulaires (actions serveur envoyées par le navigateur).
    const sansJs = await contexte(false);
    await motDePasse(sansJs.page, proprio);
    await sansJs.page.waitForURL(/\/admin\/connexion\/code$/);
    await sansJs.page.fill("#code", codeTotp(premiere.cle, Date.now() + 30_000));
    await sansJs.page.click("button[type=submit]");
    await sansJs.page.waitForURL(new URL("/admin", SITE).href);
    expect(await sansJs.page.locator("h1").innerText()).toBe("Tableau de bord");
    expect(await sansJs.page.locator("h1").isVisible()).toBe(true);
    await sansJs.contexte.close();

    p = await connexion(proprio, premiere.cle);
    const [u] = await db().select({ deuxFacteurs: utilisateur.twoFactorEnabled, echecs: utilisateur.echecsConnexion }).from(utilisateur).where(eq(utilisateur.email, proprio));
    expect(u).toEqual({ deuxFacteurs: true, echecs: 0 });
  });

  it("5 mots de passe faux verrouillent le compte, même avec le bon ensuite", async () => {
    const { contexte: c, page } = await contexte();
    for (let i = 0; i < 5; i++) {
      await motDePasse(page, verrou, "mauvais mot de passe !");
      await expect.poll(() => page.locator(".message[role=alert]").innerText()).toMatch(/incorrect|verrouillé/);
    }
    await motDePasse(page, verrou);
    await expect.poll(() => page.locator(".message[role=alert]").innerText()).toContain("verrouillé");
    expect(page.url()).toContain("/admin/connexion");
    const [u] = await db().select({ jusqua: utilisateur.verrouilleJusqua }).from(utilisateur).where(eq(utilisateur.email, verrou));
    expect(u!.jusqua!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    const audit = await db().select({ action: journalAudit.action }).from(journalAudit).where(eq(journalAudit.action, "connexion.verrouillage"));
    expect(audit.length).toBeGreaterThan(0);
    await c.close();
  });

  it("demandes : fiche, statut avec historique, note, export CSV", async () => {
    const reference = await nouvelleDemande("Client Admin");
    const { page } = p;
    await page.goto(new URL("/admin/demandes?statut=nouvelle", SITE).href);
    await page.click(`text=${reference}`).catch(() => page.click("text=Client Admin"));
    await page.goto(new URL(`/admin/demandes/${reference}`, SITE).href);
    await page.selectOption("#statut", "contactee");
    await page.click("text=Enregistrer le statut");
    await expect.poll(() => page.locator(".message[role=status]").first().innerText()).toContain("Statut enregistré");
    await page.fill("#note", "Rappeler mardi");
    await page.click("text=Ajouter la note");
    await expect.poll(() => page.locator(".historique").innerText()).toContain("Rappeler mardi");
    await page.reload();
    const historique = await page.locator(".historique").innerText();
    expect(historique).toContain("Nouvelle → Contactée");
    expect(historique).toContain("Demande reçue");
    const [d] = await db().select({ statut: demande.statut }).from(demande).where(eq(demande.reference, reference));
    expect(d?.statut).toBe("contactee");

    // Le journal ne garde pas le texte de la note.
    const notes = await db().select({ apres: journalAudit.apres }).from(journalAudit).where(eq(journalAudit.cibleId, reference));
    expect(JSON.stringify(notes)).not.toContain("Rappeler");

    const octets = await page.evaluate(async (ref) => [...new Uint8Array(await (await fetch(`/admin/demandes/export?q=${ref}`)).arrayBuffer())], reference);
    expect(octets.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    const csv = Buffer.from(octets).toString("utf8");
    expect(csv).toContain("Référence;Créée le (Douala);Type;Statut");
    expect(csv).toContain(`${reference};`);
    expect(csv).toContain(";Contactée;Client Admin;'+2376");
  });

  it("contenus : enregistrement dans le brouillon, puis publication qui met la page à jour", async () => {
    const { page } = p;
    expect(await pagePublique()).toContain(`door__price">À partir de 3${NBSP}400${NBSP}FCFA<`);
    await page.goto(new URL("/admin/contenus/prix", SITE).href);
    await page.fill("#ch-prix-pretACuire", "abc");
    await page.click("text=Enregistrer dans le brouillon");
    await expect.poll(() => page.locator(".message[role=alert]").innerText()).toContain("Prêt à cuire");
    await page.fill("#ch-prix-pretACuire", "3600");
    await page.click("text=Enregistrer dans le brouillon");
    await expect.poll(() => page.locator(".message[role=status]").innerText()).toContain("Enregistré dans le brouillon");
    // Pas encore en ligne.
    expect(await pagePublique()).toContain(`door__price">À partir de 3${NBSP}400${NBSP}FCFA<`);

    // Aperçu du brouillon.
    await page.goto(new URL("/admin/apercu", SITE).href);
    expect(await page.locator(".door__price").first().innerText()).toContain(`3${NBSP}600`);

    await page.goto(new URL("/admin/publier", SITE).href);
    expect(await page.locator("#t-diff + p, section").first().innerText()).toBeTruthy();
    await page.click("text=Publier maintenant");
    await expect.poll(() => page.locator(".message[role=status]").innerText(), { timeout: 15_000 }).toContain("publiée");
    expect(await pagePublique()).toContain(`door__price">À partir de 3${NBSP}600${NBSP}FCFA<`);

    // Retour arrière vers la version précédente.
    const premiere = page.locator("details", { hasText: "Revenir à cette version" }).first();
    const numero = await premiere.locator('input[name="numero"]').inputValue();
    const details = page.locator("details", { has: page.locator(`input[name="numero"][value="${numero}"]`) });
    await details.locator("summary").click();
    await details.locator('input[name="confirmation"]').check();
    await details.locator("button[type=submit]").click();
    await expect.poll(() => details.locator(".message[role=status]").innerText(), { timeout: 15_000 }).toContain("remise en ligne");
    expect(await pagePublique()).toContain(`door__price">À partir de 3${NBSP}400${NBSP}FCFA<`);
  });

  it("le numéro WhatsApp exige le code TOTP, et le journal le masque", async () => {
    const { page, cle } = p;
    await page.goto(new URL("/admin/contenus/coordonnees", SITE).href);
    await page.fill("#ch-coordonnees-whatsapp", "237690000001");
    await page.click("text=Enregistrer dans le brouillon");
    await expect.poll(() => page.locator(".message[role=alert]").innerText()).toContain("Code de sécurité");
    await page.fill("#ch-code", codeTotp(cle));
    await page.click("text=Enregistrer dans le brouillon");
    await expect.poll(() => page.locator(".message[role=status]").innerText()).toContain("Enregistré");
    const [ligne] = await db().select({ avant: journalAudit.avant, apres: journalAudit.apres }).from(journalAudit).where(eq(journalAudit.cibleId, "coordonnees")).orderBy(journalAudit.id);
    expect(JSON.stringify(ligne)).not.toContain("237690000001");
    expect(JSON.stringify(ligne)).toContain("•");
    // Remise en état du brouillon.
    await page.fill("#ch-coordonnees-whatsapp", "237693645565");
    await page.fill("#ch-code", codeTotp(cle, Date.now() + 30_000));
    await page.click("text=Enregistrer dans le brouillon");
    await expect.poll(() => page.locator(".message[role=status]").innerText()).toContain("Enregistré");
  });

  it("rôle Équipe : demandes seulement", async () => {
    const e = await premiereConnexion(equipe);
    await e.page.goto(new URL("/admin/contenus", SITE).href);
    await e.page.waitForURL(/\/admin\?refus=1$/);
    expect(await e.page.locator(".adm-nav").innerText()).not.toContain("Contenus");
    await e.page.goto(new URL("/admin/demandes", SITE).href);
    expect(await e.page.locator("h1").innerText()).toBe("Demandes");
    await e.contexte.close();
  });

  it("sessions actives : révocation d’une autre session", async () => {
    const autre = await connexion(proprio, p.cle);
    await p.page.goto(new URL("/admin/securite", SITE).href);
    const avant = await p.page.locator("#t-sessions ~ ul li").count();
    expect(avant).toBeGreaterThanOrEqual(2);
    await p.page.locator("form", { hasText: "Fermer toutes les autres sessions" }).locator("button").click();
    // Il ne reste que cette session : la liste se met à jour et le bouton disparaît.
    await expect.poll(() => p.page.locator("#t-sessions ~ ul li").count()).toBe(1);
    expect(await p.page.locator("#t-sessions ~ ul").innerText()).toContain("cet appareil");
    await autre.page.goto(new URL("/admin", SITE).href);
    await autre.page.waitForURL(/\/admin\/connexion$/);
    await autre.contexte.close();
  });

  it("axe-core : aucune violation sur les pages du back-office", async () => {
    const reference = await nouvelleDemande("Client Axe");
    const chemins = ["/admin", "/admin/demandes", `/admin/demandes/${reference}`, "/admin/contenus", "/admin/contenus/fetes", "/admin/publier", "/admin/reglages", "/admin/securite"];
    const toutes: string[] = [];
    for (const c of chemins) toutes.push(...(await violations(p.page, c)));
    const { contexte: c, page } = await contexte();
    toutes.push(...(await violations(page, "/admin/connexion")));
    await c.close();
    expect(toutes).toEqual([]);
  });
});
