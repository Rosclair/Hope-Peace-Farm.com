// Phase 4 : numéro WhatsApp, référence, validation serveur, message avec référence,
// lien de confirmation signé, anti-spam (empreintes, adresse, origine), e-mail au
// propriétaire, remplacement du texte de confidentialité de la maquette.

import { describe, expect, it } from "vitest";
import { remplacerConfidentialiteMaquette, COURT_MAQUETTE, PREMIER_PARAGRAPHE_MAQUETTE } from "@/lib/contenu/confidentialite";
import { controlerPublication } from "@/lib/contenu/controles";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import { adresseVisiteur, empreinte, origineValide } from "@/lib/demandes/antispam";
import { emailNouvelleDemande, lignesDemande } from "@/lib/demandes/email";
import { messageDemande, reponsesTexte } from "@/lib/demandes/enregistrer";
import { DUREE_JETON_MS, lireConfirmation, signerConfirmation } from "@/lib/demandes/jeton";
import { normaliserNumero } from "@/lib/demandes/numero";
import { FORME_REFERENCE, nouvelleReference } from "@/lib/demandes/reference";
import { isoDouala, validerDemande } from "@/lib/demandes/schema";
import { composerMessage, messageAvecReference } from "@/lib/whatsapp/messages";

describe("normalisation du numéro WhatsApp", () => {
  it.each([
    ["693645565", "+237693645565"],
    ["6 93 64 55 65", "+237693645565"],
    ["6.93.64.55.65", "+237693645565"],
    ["(6) 93-64-55-65", "+237693645565"],
    ["222 12 34 56", "+237222123456"],
    ["+237 693 64 55 65", "+237693645565"],
    ["00237693645565", "+237693645565"],
    ["237693645565", "+237693645565"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
    ["+1 (514) 555-0199", "+15145550199"],
    ["+49 1512 3456789", "+4915123456789"],
    ["6 93 64 55 65", "+237693645565"],
  ])("« %s » → %s", (brut, attendu) => {
    expect(normaliserNumero(brut)).toBe(attendu);
  });

  it.each([
    "",
    "abc",
    "93645565",
    "793645565",
    "6936455651",
    "+237793645565",
    "+23769364556",
    "+1234567",
    "+1234567890123456",
    "+0612345678",
    "0612345678",
    "6 93 64 55 65 x",
  ])("refuse « %s »", (brut) => {
    expect(normaliserNumero(brut)).toBeNull();
  });
});

describe("référence HP-AAMMJJ-XXXXXX", () => {
  it("a la bonne forme, sans 0, O, 1 ni I", () => {
    for (let i = 0; i < 500; i++) {
      const r = nouvelleReference(Date.parse("2026-10-14T10:00:00Z"));
      expect(r).toMatch(FORME_REFERENCE);
      expect(r.startsWith("HP-261014-")).toBe(true);
      expect(r.slice(10)).not.toMatch(/[01OI]/);
    }
  });

  it("prend la date de Douala (UTC+1) : 23 h 30 UTC est déjà le lendemain", () => {
    expect(nouvelleReference(Date.parse("2026-12-31T23:30:00Z")).slice(0, 10)).toBe("HP-270101-");
    expect(nouvelleReference(Date.parse("2026-12-31T22:59:00Z")).slice(0, 10)).toBe("HP-261231-");
  });

  it("tire des suffixes variés", () => {
    const tirages = new Set(Array.from({ length: 200 }, () => nouvelleReference().slice(10)));
    expect(tirages.size).toBe(200);
  });
});

const dans = (jours: number) => isoDouala(jours);
const CEREMONIE = {
  formulaire: "ceremonie",
  ceremonie: "funerailles",
  date: dans(30),
  lieu: "Bazou, chefferie, près du marché",
  invites: "100 à 200",
  nom: "Exemple Test",
  residence: "Douala",
  whatsapp: "6 93 64 55 65",
  consentement: "1",
};
const POULETS = {
  formulaire: "poulets",
  nombre: "25",
  preparation: "sauce",
  date: dans(5),
  reception: "livraison",
  lieu: "Douala, Bonapriso",
  nom: "Awa",
  precisions: "Avant 10 h",
  annonces: "1",
  whatsapp: "+33 6 12 34 56 78",
  consentement: "1",
};
const PRO = {
  formulaire: "pro",
  etablissement: "Chez Mama",
  type: "restaurant",
  ville: "Bafoussam, marché A",
  volume: "10 à 30",
  preparation: "prêts à cuire",
  contact: "Mama, gérante",
  whatsapp: "237693645565",
  consentement: "1",
};

describe("validation serveur des demandes", () => {
  it.each([CEREMONIE, POULETS, PRO])("accepte un envoi complet (%#)", (envoi) => {
    const r = validerDemande(envoi);
    expect(r.ok).toBe(true);
  });

  it("normalise le numéro et garde les réponses du formulaire", () => {
    const r = validerDemande(POULETS);
    if (!r.ok) throw new Error("refusé");
    expect(r.demande.type).toBe("poulets");
    expect(r.demande.donnees.whatsapp).toBe("+33612345678");
    expect(r.demande.donnees.annonces).toBe(true);
    expect(r.demande.donnees.consentement).toBe(true);
  });

  it("le message composé côté serveur est celui que compose le navigateur", () => {
    for (const envoi of [CEREMONIE, POULETS, PRO]) {
      const r = validerDemande(envoi);
      if (!r.ok) throw new Error("refusé");
      const { formulaire, ...reponses } = envoi;
      expect(messageDemande(r.demande)).toBe(composerMessage(r.demande.type, reponses));
      expect(reponsesTexte(r.demande).consentement).toBe("1");
      expect(formulaire).toBe(r.demande.type);
    }
  });

  it("refuse et nomme les champs fautifs", () => {
    const cas: [Record<string, unknown>, string[]][] = [
      [{ ...CEREMONIE, whatsapp: "12345" }, ["whatsapp"]],
      [{ ...CEREMONIE, consentement: undefined }, ["consentement"]],
      [{ ...CEREMONIE, consentement: "" }, ["consentement"]],
      [{ ...CEREMONIE, nom: "   " }, ["nom"]],
      [{ ...CEREMONIE, lieu: "x".repeat(141) }, ["lieu"]],
      [{ ...CEREMONIE, ceremonie: "anniversaire" }, ["ceremonie"]],
      [{ ...CEREMONIE, date: "" }, ["date"]],
      [{ ...CEREMONIE, date: dans(-3) }, ["date"]],
      [{ ...CEREMONIE, date: dans(400) }, ["date"]],
      [{ ...POULETS, nombre: "0" }, ["nombre"]],
      [{ ...POULETS, nombre: "10000" }, ["nombre"]],
      [{ ...POULETS, lieu: "" }, ["lieu"]],
      [{ ...PRO, volume: "beaucoup" }, ["volume"]],
      [{ ...PRO, precisions: "a\u0000b" }, ["precisions"]],
      [{ ...PRO, formulaire: "autre" }, ["formulaire"]],
    ];
    for (const [envoi, champs] of cas) {
      const r = validerDemande(envoi);
      expect(r.ok, JSON.stringify(champs)).toBe(false);
      if (!r.ok) expect(r.champs).toEqual(champs);
    }
  });

  it("date inconnue : la date n’est pas exigée et n’est pas gardée", () => {
    const r = validerDemande({ ...CEREMONIE, date: "", date_inconnue: "1" });
    if (!r.ok) throw new Error("refusé");
    expect(r.demande.type === "ceremonie" && r.demande.donnees.date).toBe("");
  });

  it("retrait à la ferme : le lieu n’est ni exigé ni gardé", () => {
    const r = validerDemande({ ...POULETS, reception: "retrait", lieu: "ignoré" });
    if (!r.ok) throw new Error("refusé");
    expect(r.demande.type === "poulets" && r.demande.donnees.lieu).toBe("");
  });

  it("ignore les champs inconnus, lit les champs techniques à part", () => {
    const r = validerDemande({ ...PRO, site_web: "http://spam", duree: "4200", cle: "abcdef12-3456-7890-abcd-ef1234567890", src: "flyer-mars", inconnu: "x" });
    if (!r.ok) throw new Error("refusé");
    expect(r.envoi).toMatchObject({ site_web: "http://spam", duree: 4200, src: "flyer-mars" });
    expect(r.demande.donnees).not.toHaveProperty("inconnu");
    expect(r.demande.donnees).not.toHaveProperty("site_web");
  });

  it("une source mal formée est ignorée, pas bloquante", () => {
    const r = validerDemande({ ...PRO, src: "<script>", referent: "a b" });
    expect(r.ok && r.envoi.src).toBeUndefined();
  });
});

describe("message avec référence", () => {
  it("ajoute « (Réf. …) » à la fin du message de la maquette", () => {
    expect(messageAvecReference("Bonjour.", "HP-261014-ABCDEF")).toBe("Bonjour. (Réf. HP-261014-ABCDEF)");
    expect(messageAvecReference("Bonjour.", null)).toBe("Bonjour.");
  });
});

describe("lien de confirmation signé", () => {
  const secret = "x".repeat(40);
  const ref = "HP-261014-ABCDEF";

  it("se relit tant qu’il est valable", () => {
    const t0 = Date.parse("2026-10-14T10:00:00Z");
    const jeton = signerConfirmation(ref, secret, t0);
    expect(jeton).not.toMatch(/[^A-Za-z0-9._-]/);
    expect(lireConfirmation(jeton, secret, t0 + 60_000)).toBe(ref);
    expect(lireConfirmation(jeton, secret, t0 + DUREE_JETON_MS + 1)).toBeNull();
  });

  it("refuse un jeton modifié ou signé avec un autre secret", () => {
    const jeton = signerConfirmation(ref, secret);
    expect(lireConfirmation(jeton.replace("ABCDEF", "ABCDEG"), secret)).toBeNull();
    expect(lireConfirmation(jeton, "y".repeat(40))).toBeNull();
    expect(lireConfirmation(`${jeton}x`, secret)).toBeNull();
    expect(lireConfirmation(undefined, secret)).toBeNull();
    expect(lireConfirmation("a.b.c", secret)).toBeNull();
  });
});

describe("anti-spam", () => {
  const secret = "z".repeat(40);

  it("empreinte : stable dans la journée, différente le lendemain, jamais la valeur en clair", () => {
    const a = empreinte("203.0.113.7", secret, "2026-10-14");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(empreinte("203.0.113.7", secret, "2026-10-14")).toBe(a);
    expect(empreinte("203.0.113.7", secret, "2026-10-15")).not.toBe(a);
    expect(empreinte("203.0.113.8", secret, "2026-10-14")).not.toBe(a);
    expect(a).not.toContain("203");
  });

  it("adresse du visiteur : celle qu’ajoute le dernier proxy de confiance", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });
    expect(adresseVisiteur(h, "x-forwarded-for", 1)).toBe("203.0.113.7");
    expect(adresseVisiteur(h, "x-forwarded-for", 2)).toBe("1.1.1.1");
    expect(adresseVisiteur(h, "x-forwarded-for", 5)).toBe("1.1.1.1");
    expect(adresseVisiteur(h, "x-forwarded-for", 0)).toBeNull();
    expect(adresseVisiteur(new Headers(), "x-forwarded-for", 1)).toBeNull();
    expect(adresseVisiteur(new Headers({ "x-real-ip": "203.0.113.9" }), "x-real-ip", 1)).toBe("203.0.113.9");
  });

  it("origine : le site seulement", () => {
    const site = "https://hopeandpeacefarm.com";
    expect(origineValide(new Headers({ origin: site }), site)).toBe(true);
    expect(origineValide(new Headers({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" }), "http://localhost:3000")).toBe(true);
    expect(origineValide(new Headers({ origin: "https://exemple.com", host: "hopeandpeacefarm.com" }), site)).toBe(false);
    expect(origineValide(new Headers({ origin: "null" }), site)).toBe(false);
    expect(origineValide(new Headers({ "sec-fetch-site": "cross-site" }), site)).toBe(false);
    expect(origineValide(new Headers({ "sec-fetch-site": "same-origin" }), site)).toBe(true);
    expect(origineValide(new Headers(), site)).toBe(true);
  });
});

describe("e-mail au propriétaire", () => {
  it("reprend les réponses, la référence et le lien vers le WhatsApp du client, échappe le HTML", () => {
    const r = validerDemande({ ...POULETS, nom: "Awa <b>&</b>" });
    if (!r.ok) throw new Error("refusé");
    const e = emailNouvelleDemande({ demande: r.demande, reference: "HP-261014-ABCDEF", whatsapp: "+33612345678", message: "Bonjour" });
    expect(e.sujet).toBe("Nouvelle demande Poulets — HP-261014-ABCDEF");
    expect(e.texte).toContain("Préparation : Découpé sauce (10 à 12 morceaux)");
    expect(e.texte).toContain("Lieu de livraison : Douala, Bonapriso");
    expect(e.texte).toContain("https://wa.me/33612345678");
    expect(e.html).toContain("Awa &lt;b&gt;&amp;&lt;/b&gt;");
    expect(e.html).not.toMatch(/<img|src=|https?:\/\/(?!wa\.me)/);
  });

  it("omet les lignes vides (lieu en retrait, précisions absentes)", () => {
    const r = validerDemande({ ...POULETS, reception: "retrait", precisions: "" });
    if (!r.ok) throw new Error("refusé");
    const libelles = lignesDemande(r.demande, "+33612345678").map(([k]) => k);
    expect(libelles).not.toContain("Lieu de livraison");
    expect(libelles).not.toContain("Précisions");
  });
});

describe("texte de confidentialité (phase 4)", () => {
  const maquette = {
    ...CONTENU_INITIAL,
    demande: { ...CONTENU_INITIAL.demande, confidentialite: COURT_MAQUETTE },
    confidentialite: { paragraphes: [PREMIER_PARAGRAPHE_MAQUETTE, ...CONTENU_INITIAL.confidentialite.paragraphes.slice(1)] },
  };

  it("le contenu initial ne dit plus que rien n’est enregistré et reste publiable", () => {
    const c = controlerPublication(CONTENU_INITIAL);
    expect(c.publiable).toBe(true);
  });

  it("les anciens textes de la maquette bloquent la publication", () => {
    const c = controlerPublication(maquette);
    expect(c.publiable).toBe(false);
    expect(c.problemes.filter((p) => p.bloquant).map((p) => p.chemin)).toEqual([
      "demande.confidentialite",
      "confidentialite.paragraphes[0]",
    ]);
  });

  it("sont remplacés par le texte réécrit ; un texte déjà modifié est laissé tel quel", () => {
    const r = remplacerConfidentialiteMaquette(maquette);
    expect(r?.demande.confidentialite).toBe(CONTENU_INITIAL.demande.confidentialite);
    expect(r?.confidentialite).toEqual(CONTENU_INITIAL.confidentialite);
    expect(remplacerConfidentialiteMaquette(CONTENU_INITIAL)).toBeNull();
  });
});
