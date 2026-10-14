// Demandes sur une vraie base (hpf_test) : enregistrement en transaction avec son
// e-mail, clé d’envoi (pas de doublon), limites de débit, purge à la durée de
// conservation, mise à jour du texte de confidentialité d’un contenu déjà publié.

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { COURT_MAQUETTE, PREMIER_PARAGRAPHE_MAQUETTE } from "@/lib/contenu/confidentialite";
import { enregistrerBrouillon, initialiserSiVide, lireBrouillon, lireVersionEnLigne, mettreAJourConfidentialite } from "@/lib/contenu/depot";
import { empreinteContenu } from "@/lib/contenu/empreinte";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import type { ContenuPage } from "@/lib/contenu/types";
import { appliquerLimites, LIMITES, purgerLimites } from "@/lib/demandes/antispam";
import { enregistrerDemande } from "@/lib/demandes/enregistrer";
import { purgerDemandes } from "@/lib/demandes/purge";
import { FORME_REFERENCE } from "@/lib/demandes/reference";
import { isoDouala, validerDemande } from "@/lib/demandes/schema";
import { base, db } from "@/lib/db/client";
import { appliquerMigrations } from "@/lib/db/migrer";
import { demande, demandeEvenement, emailSortant, limiteDebit } from "@/lib/db/schema";

beforeAll(async () => {
  expect(process.env.DB_NAME).toMatch(/_test$/);
  await appliquerMigrations();
});
beforeEach(async () => {
  for (const table of ["email_sortant", "demande_evenement", "demande", "limite_debit"]) await db().execute(sql.raw(`DELETE FROM ${table}`));
});
afterAll(async () => {
  await base().pool.end();
});

let numero = 600000000;
/** Envoi valide, avec un numéro différent à chaque appel (limite par numéro). */
function envoi(extra: Record<string, unknown> = {}) {
  numero += 1;
  const v = validerDemande({
    formulaire: "poulets",
    nombre: "12",
    preparation: "pret",
    date: isoDouala(10),
    reception: "retrait",
    nom: "Client Test",
    whatsapp: String(numero),
    consentement: "1",
    ...extra,
  });
  if (!v.ok) throw new Error(`envoi refusé : ${v.champs.join(", ")}`);
  return v;
}

describe("enregistrement", () => {
  it("enregistre la demande, son événement et l’e-mail au propriétaire, dans une même transaction", async () => {
    const v = envoi({ src: "flyer", annonces: "1" });
    const r = await enregistrerDemande({ ...v, mode: "js", ip: "203.0.113.1" });
    if (r.statut !== "enregistree") throw new Error(r.statut);
    expect(r.reference).toMatch(FORME_REFERENCE);
    expect(r.message.endsWith(`(Réf. ${r.reference})`)).toBe(true);

    const [d] = await db().select().from(demande).where(eq(demande.reference, r.reference));
    expect(d).toMatchObject({ type: "poulets", statut: "nouvelle", nom: "Client Test", annonces: true, sourceCode: "flyer", modeEnvoi: "js" });
    expect(d?.whatsappE164).toMatch(/^\+2376\d{8}$/);
    expect(d?.reponses).toMatchObject({ nombre: "12", preparation: "pret", reception: "retrait" });
    expect(d?.reponses).not.toHaveProperty("whatsapp");
    expect(d?.reponses).not.toHaveProperty("nom");
    expect(d?.consentementVersion).toBe("2026-10-14");

    const evenements = await db().select().from(demandeEvenement).where(eq(demandeEvenement.demandeId, d!.id));
    expect(evenements.map((e) => e.type)).toEqual(["creation"]);
    const [e] = await db().select().from(emailSortant).where(eq(emailSortant.id, r.emailId!));
    expect(e).toMatchObject({ type: "nouvelle_demande", statut: "en_attente", demandeId: d!.id });
    expect(e?.sujet).toContain(r.reference);
  });

  it("la même clé d’envoi renvoie la même demande (« Réessayer »), sans doublon", async () => {
    const v = envoi({ cle: "0123456789abcdef0123456789abcdef" });
    const a = await enregistrerDemande({ ...v, mode: "js", ip: null });
    const b = await enregistrerDemande({ ...v, mode: "js", ip: null });
    if (a.statut === "limite" || b.statut === "limite") throw new Error("limite");
    expect(a.statut).toBe("enregistree");
    expect(b).toMatchObject({ statut: "existante", reference: a.reference, message: a.message });
    const [{ n }] = (await db().select({ n: sql<number>`COUNT(*)` }).from(demande)) as [{ n: number }];
    expect(Number(n)).toBe(1);
  });

  it("deux envois simultanés de la même clé ne créent qu’une demande", async () => {
    const v = envoi({ cle: "simultane-0123456789abcdef" });
    const [a, b] = await Promise.all([
      enregistrerDemande({ ...v, mode: "js", ip: null }),
      enregistrerDemande({ ...v, mode: "js", ip: null }),
    ]);
    expect(a.statut !== "limite" && b.statut !== "limite" && a.reference === b.reference).toBe(true);
    const [{ n }] = (await db().select({ n: sql<number>`COUNT(*)` }).from(demande)) as [{ n: number }];
    expect(Number(n)).toBe(1);
  });
});

describe("limites de débit", () => {
  it(`par numéro : ${LIMITES.numeroParJour} demandes par jour, puis refus`, async () => {
    const v = envoi();
    for (let i = 0; i < LIMITES.numeroParJour; i++) {
      expect((await enregistrerDemande({ ...v, mode: "js", ip: null })).statut).toBe("enregistree");
    }
    expect((await enregistrerDemande({ ...v, mode: "js", ip: null })).statut).toBe("limite");
  });

  it(`par adresse : ${LIMITES.ipParHeure} envois par heure, puis refus ; aucune adresse en clair`, async () => {
    for (let i = 0; i < LIMITES.ipParHeure; i++) expect(await appliquerLimites("198.51.100.4", `+23769${String(i).padStart(7, "0")}`)).toBe("ok");
    expect(await appliquerLimites("198.51.100.4", "+237690000099")).toBe("ip");
    expect(await appliquerLimites("198.51.100.5", "+237690000099")).toBe("ok");
    const cles = (await db().select({ cle: limiteDebit.cle }).from(limiteDebit)).map((l) => l.cle);
    expect(cles.every((c) => /^(ip|tel):[0-9a-f]{32}$/.test(c))).toBe(true);
    expect(cles.join()).not.toContain("198.51");
    expect(cles.join()).not.toContain("237");
  });

  it("purge les compteurs de plus de deux jours", async () => {
    await db().insert(limiteDebit).values([
      { cle: "ip:ancien", fenetreDebut: new Date(Date.now() - 3 * 864e5), compteur: 1 },
      { cle: "ip:recent", fenetreDebut: new Date(), compteur: 1 },
    ]);
    expect(await purgerLimites()).toBe(1);
  });
});

describe("conservation", () => {
  it("purge les demandes au-delà de la durée, avec leur historique et leurs e-mails", async () => {
    const vieille = await enregistrerDemande({ ...envoi(), mode: "sans_js", ip: null });
    const recente = await enregistrerDemande({ ...envoi(), mode: "js", ip: null });
    if (vieille.statut === "limite" || recente.statut === "limite") throw new Error("limite");
    await db()
      .update(demande)
      .set({ majLe: sql`CURRENT_TIMESTAMP(3) - INTERVAL 13 MONTH` })
      .where(eq(demande.reference, vieille.reference));

    expect(await purgerDemandes(12)).toBe(1);
    const restantes = (await db().select({ reference: demande.reference }).from(demande)).map((d) => d.reference);
    expect(restantes).toEqual([recente.reference]);
    expect(await db().select().from(emailSortant).where(eq(emailSortant.id, vieille.emailId!))).toEqual([]);
    const [{ n }] = (await db().select({ n: sql<number>`COUNT(*)` }).from(demandeEvenement)) as [{ n: number }];
    expect(Number(n)).toBe(1);
  });
});

describe("texte de confidentialité d’un contenu déjà publié", () => {
  const avecMaquette = (c: ContenuPage): ContenuPage => ({
    ...c,
    demande: { ...c.demande, confidentialite: COURT_MAQUETTE },
    confidentialite: { paragraphes: [PREMIER_PARAGRAPHE_MAQUETTE, ...c.confidentialite.paragraphes.slice(1)] },
  });

  /** Base dans l’état d’une installation de la phase 3 : maquette publiée, brouillon identique. */
  async function installationPhase3() {
    for (const table of ["version_contenu", "contenu_brouillon", "etat_publication"]) await db().execute(sql.raw(`DELETE FROM ${table}`));
    await initialiserSiVide("test");
    const ancien = avecMaquette(CONTENU_INITIAL);
    await db().execute(sql`UPDATE version_contenu SET donnees = ${JSON.stringify(ancien)}, empreinte = ${empreinteContenu(ancien)}`);
    await db().execute(sql`UPDATE contenu_brouillon SET donnees = ${JSON.stringify(ancien)}`);
  }

  it("brouillon sans autre modification : le nouveau texte est publié aussitôt, une seule fois", async () => {
    await installationPhase3();
    expect(await mettreAJourConfidentialite("test")).toBe("publiee");
    const v = await lireVersionEnLigne();
    expect(v?.numero).toBe(2);
    expect((v?.donnees as ContenuPage).confidentialite).toEqual(CONTENU_INITIAL.confidentialite);
    expect((v?.donnees as ContenuPage).demande.confidentialite).toBe(CONTENU_INITIAL.demande.confidentialite);
    expect(await mettreAJourConfidentialite("test")).toBe("a_jour");
    expect((await lireVersionEnLigne())?.numero).toBe(2);
  });

  it("brouillon avec d’autres modifications en attente : corrigé dans le brouillon seulement", async () => {
    await installationPhase3();
    const b = await lireBrouillon();
    const donnees = structuredClone(b!.donnees) as ContenuPage;
    donnees.pied.signature = "Signature en attente";
    await enregistrerBrouillon({ donnees, aConfirmer: b!.aConfirmer, revisionAttendue: b!.revision, par: "test" });

    expect(await mettreAJourConfidentialite("test")).toBe("brouillon_seul");
    expect((await lireVersionEnLigne())?.numero).toBe(1);
    const apres = (await lireBrouillon())!.donnees as ContenuPage;
    expect(apres.confidentialite).toEqual(CONTENU_INITIAL.confidentialite);
    expect(apres.pied.signature).toBe("Signature en attente");
  });
});
