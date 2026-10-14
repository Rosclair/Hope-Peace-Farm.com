import { describe, expect, it } from "vitest";
import { champsDuGroupe, cheminPremierNiveau, ecrireChemin, feuilles, GROUPES, lireChemin, type Champ } from "@/lib/admin/champs";
import { BOM, cellule, versCsv } from "@/lib/admin/csv";
import { differences } from "@/lib/admin/differences";
import { dateHeure, depuis } from "@/lib/admin/format";
import { GROUPES_LIBELLES, libelleDe } from "@/lib/admin/libelles";
import { masquerEmail, masquerNumero, valeurJournal } from "@/lib/admin/masque";
import { secretLisible } from "@/lib/admin/qr";
import { resumeAppareil } from "@/lib/auth/appareil";
import { dureeVerrou, ECHECS_AVANT_VERROU, minutesRestantes } from "@/lib/auth/verrouillage";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import { A_CONFIRMER_INITIAL } from "@/lib/contenu/initial";

describe("export CSV", () => {
  it("UTF-8 avec BOM, point-virgule, CRLF", () => {
    const csv = versCsv(["A", "B"], [["été", 3]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}A;B\r\nété;3\r\n`);
  });

  it("neutralise les formules (= + - @, tabulation, retour chariot)", () => {
    expect(cellule("=SOMME(A1:A9)")).toBe("'=SOMME(A1:A9)");
    expect(cellule("+237693645565")).toBe("'+237693645565");
    expect(cellule("-2")).toBe("'-2");
    expect(cellule("@cmd")).toBe("'@cmd");
    expect(cellule("\tx")).toBe("'\tx");
    expect(cellule("\rx")).toBe(`"'\rx"`);
    expect(cellule("Bonjour")).toBe("Bonjour");
  });

  it("entoure de guillemets les cellules avec ; \" ou retour à la ligne", () => {
    expect(cellule("a;b")).toBe('"a;b"');
    expect(cellule('il dit "oui"')).toBe('"il dit ""oui"""');
    expect(cellule("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
    expect(cellule('=1;"x"')).toBe(`"'=1;""x"""`);
  });

  it("cellules vides, nombres et dates", () => {
    expect(cellule(null)).toBe("");
    expect(cellule(undefined)).toBe("");
    expect(cellule(0)).toBe("0");
    expect(cellule(new Date("2026-10-14T08:00:00Z"))).toBe("2026-10-14T08:00:00.000Z");
  });
});

describe("masquage au journal", () => {
  it("numéros : indicatif, premier chiffre, quatre derniers", () => {
    expect(masquerNumero("237693645565")).toBe("+237 6•• •• 55 65");
    expect(masquerNumero("+237 6 93 64 55 65")).toBe("+237 6•• •• 55 65");
    expect(masquerNumero("+33612345678")).toBe("+3•• •• 56 78");
    expect(masquerNumero("123")).toBe("••••");
  });

  it("e-mails", () => {
    expect(masquerEmail("ieeservices2019@gmail.com")).toBe("i•••@gmail.com");
    expect(masquerEmail("pas une adresse")).toBe("•••");
  });

  it("seuls les champs sensibles sont masqués", () => {
    expect(valeurJournal("coordonnees.whatsapp", "237693645565")).toBe("+237 6•• •• 55 65");
    expect(valeurJournal("paiement.mtn", "+237670000000")).toBe("+237 6•• •• 00 00");
    expect(valeurJournal("paiement.nomCompte", "Jean Dupont")).toBe("•••");
    expect(valeurJournal("reglage.emailNotification", "a@b.cm")).toBe("a•••@b.cm");
    expect(valeurJournal("prix.vivant", 3000)).toBe(3000);
    expect(valeurJournal("paiement.mtn", "")).toBe("");
  });
});

describe("verrouillage", () => {
  it("rien avant 5 échecs, puis 15 min doublées à chaque échec, 24 h au plus", () => {
    for (let i = 0; i < ECHECS_AVANT_VERROU; i++) expect(dureeVerrou(i)).toBe(0);
    expect(dureeVerrou(5)).toBe(15 * 60_000);
    expect(dureeVerrou(6)).toBe(30 * 60_000);
    expect(dureeVerrou(7)).toBe(60 * 60_000);
    expect(dureeVerrou(20)).toBe(24 * 3600_000);
  });

  it("minutes restantes arrondies au-dessus, 1 au moins", () => {
    const t = Date.parse("2026-10-14T10:00:00Z");
    expect(minutesRestantes(new Date(t + 14 * 60_000 + 1), t)).toBe(15);
    expect(minutesRestantes(new Date(t - 1000), t)).toBe(1);
  });
});

describe("appareil d’une session", () => {
  it("résume l’agent sans le garder", () => {
    expect(resumeAppareil("Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36")).toBe(
      "Samsung Internet · Android",
    );
    expect(resumeAppareil("Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1")).toBe(
      "Safari · iOS",
    );
    expect(resumeAppareil("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36")).toBe("Chrome · Windows");
    expect(resumeAppareil("Mozilla/5.0 (Linux; Android 12) [FBAN/EMA;FBLC/fr_FR;FBAV/300.0]")).toBe("Facebook · Android");
    expect(resumeAppareil(null)).toBe("Appareil inconnu");
  });
});

describe("éditeur de contenus : champs déduits du schéma", () => {
  const tous = (g: string) => feuilles(champsDuGroupe(g, lireChemin(CONTENU_INITIAL, g)));
  const champ = (g: string, chemin: string) => tous(g).find((c) => c.chemin === chemin) as Champ;

  it("chaque groupe a un titre et chaque feuille un libellé lisible", () => {
    for (const g of GROUPES) {
      expect(GROUPES_LIBELLES[g]?.titre, g).toBeTruthy();
      for (const c of tous(g)) expect(c.libelle, c.chemin).not.toMatch(/^[a-z]+[A-Z]/);
    }
  });

  it("toutes les valeurs de la maquette sont éditables (une feuille par valeur)", () => {
    const n = GROUPES.reduce((s, g) => s + tous(g).length, 0);
    const valeurs = (v: unknown): number =>
      Array.isArray(v) ? v.reduce((s: number, x) => s + valeurs(x), 0) : v && typeof v === "object" ? Object.values(v).reduce((s: number, x) => s + valeurs(x), 0) : 1;
    expect(n).toBe(valeurs(CONTENU_INITIAL));
  });

  it("règles reprises du schéma : obligatoire, longueur, bornes, dates, choix", () => {
    expect(champ("seo", "seo.titre")).toMatchObject({ genre: "texte", requis: true, max: 90 });
    expect(champ("coordonnees", "coordonnees.emailContact")).toMatchObject({ genre: "texte", requis: false });
    expect(champ("coordonnees", "coordonnees.chaineWhatsapp")).toMatchObject({ genre: "texte", requis: true });
    expect(champ("legal", "legal.hebergeur")).toMatchObject({ genre: "texte", requis: false, max: 300, long: true });
    expect(champ("prix", "prix.vivant")).toMatchObject({ genre: "entier", min: 0, max: 1_000_000 });
    expect(champ("conditions", "conditions.acomptePourcent")).toMatchObject({ genre: "entier", min: 0, max: 100 });
    expect(champ("fetes", "fetes.dateFin")).toMatchObject({ genre: "date" });
    expect(champ("fetes", "fetes.actif")).toMatchObject({ genre: "booleen" });
    expect(champ("garanties", "garanties.elements[0].icone")).toMatchObject({ genre: "choix" });
    expect(champ("ceremonies", "ceremonies.formules.tableau[0].valeurs[2]")).toMatchObject({ genre: "texte", requis: false });
  });

  it("les marques « à confirmer » de départ portent sur des champs de premier niveau", () => {
    for (const p of A_CONFIRMER_INITIAL) expect(cheminPremierNiveau(`${p}[0].nom`)).toBe(p);
    expect(cheminPremierNiveau("livraison.zones[2].regle")).toBe("livraison.zones");
    expect(cheminPremierNiveau("prix.vivant")).toBe("prix.vivant");
  });

  it("lecture et écriture par chemin, sans modifier l’original", () => {
    const c = structuredClone(CONTENU_INITIAL);
    expect(lireChemin(c, "questions.groupes[1].questions[0].question")).toBe(c.questions.groupes[1]!.questions[0]!.question);
    const n = ecrireChemin(c, "livraison.zones[0].nom", "Bafoussam");
    expect(n.livraison.zones[0]!.nom).toBe("Bafoussam");
    expect(c.livraison.zones[0]!.nom).toBe(CONTENU_INITIAL.livraison.zones[0]!.nom);
    expect(() => ecrireChemin(c, "prix.inconnu", 1)).toThrow(/Chemin inconnu/);
  });

  it("libellés : dictionnaire, puis clé, puis numéro d’élément", () => {
    expect(libelleDe("coordonnees.whatsapp")).toBe("Numéro WhatsApp");
    expect(libelleDe("accueil.surTitre")).toBe("Sur-titre");
    expect(libelleDe("accueil.titre[1]")).toBe("n° 2");
  });
});

describe("différences avant publication", () => {
  it("liste les feuilles changées", () => {
    const apres = ecrireChemin(ecrireChemin(CONTENU_INITIAL, "prix.vivant", 3100), "accueil.titre[0]", "Autre");
    expect(differences(CONTENU_INITIAL, apres)).toEqual([
      { chemin: "prix.vivant", avant: CONTENU_INITIAL.prix.vivant, apres: 3100 },
      { chemin: "accueil.titre[0]", avant: CONTENU_INITIAL.accueil.titre[0], apres: "Autre" },
    ]);
    expect(differences(CONTENU_INITIAL, structuredClone(CONTENU_INITIAL))).toEqual([]);
  });
});

describe("divers", () => {
  it("clé TOTP lisible par groupes de 4", () => {
    expect(secretLisible("otpauth://totp/Hope?secret=ABCDEFGHIJKLMNOP&issuer=Hope")).toBe("ABCD EFGH IJKL MNOP");
  });

  it("dates à l’heure de Douala", () => {
    expect(dateHeure(new Date("2026-10-14T23:30:00Z"))).toBe("15/10/2026 00:30");
    const t = Date.parse("2026-10-14T10:00:00Z");
    expect(depuis(new Date(t - 5 * 60_000), t)).toBe("il y a 5 min");
    expect(depuis(new Date(t - 30 * 3600_000), t)).toBe("il y a 30 h");
    expect(depuis(new Date(t - 72 * 3600_000), t)).toBe("il y a 3 j");
  });
});

describe("réponses lisibles (fiche et export)", () => {
  it("codes et dates traduits", async () => {
    const { valeurReponse, texteReponses } = await import("@/lib/admin/demandes");
    expect(valeurReponse("preparation", "pret")).toBe("prêt à cuire");
    expect(valeurReponse("date", "2026-12-24").replace(/\s/g, " ")).toBe("24 décembre 2026");
    expect(valeurReponse("reception", "retrait")).toBe("retrait à la ferme");
    expect(valeurReponse("lieu", "Bafoussam")).toBe("Bafoussam");
    expect(texteReponses({ nombre: "4", preparation: "braise", date_inconnue: false, precisions: "" })).toBe("Nombre : 4 | Préparation : découpé pour la braise");
  });
});
