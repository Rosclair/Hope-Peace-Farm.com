import { describe, expect, it } from "vitest";
import { cheminExiste, controlerPublication } from "@/lib/contenu/controles";
import { empreinteContenu } from "@/lib/contenu/empreinte";
import { dateDouala, etatFetes } from "@/lib/contenu/fetes";
import { A_CONFIRMER_INITIAL, CONTENU_INITIAL } from "@/lib/contenu/initial";
import { schemaContenu } from "@/lib/contenu/schema";
import type { ContenuPage } from "@/lib/contenu/types";
import { SCRIPT_TETE } from "@/lib/site/script-tete";

const copie = (): ContenuPage => structuredClone(CONTENU_INITIAL);
const bloquants = (donnees: unknown) =>
  controlerPublication(donnees)
    .problemes.filter((p) => p.bloquant)
    .map((p) => `${p.chemin} : ${p.message}`);

describe("schéma du contenu", () => {
  it("accepte le contenu de la maquette", () => {
    expect(schemaContenu.safeParse(CONTENU_INITIAL).success).toBe(true);
  });

  it("refuse les valeurs mal formées, avec le chemin du champ", () => {
    const cas: [string, (c: ContenuPage) => void][] = [
      ["coordonnees.whatsapp", (c) => (c.coordonnees.whatsapp = "+237 693 64 55 65")],
      ["coordonnees.telephone", (c) => (c.coordonnees.telephone = "693645565")],
      ["coordonnees.facebook", (c) => (c.coordonnees.facebook = "https://exemple.com/page")],
      ["coordonnees.chaineWhatsapp", (c) => (c.coordonnees.chaineWhatsapp = "https://whatsapp.com/autre/123")],
      ["coordonnees.lienItineraire", (c) => (c.coordonnees.lienItineraire = "https://exemple.com/carte")],
      ["coordonnees.emailContact", (c) => (c.coordonnees.emailContact = "pas-une-adresse")],
      ["prix.vivant", (c) => (c.prix.vivant = 3000.5)],
      ["conditions.acomptePourcent", (c) => (c.conditions.acomptePourcent = 120)],
      ["fetes.dateLimitePrixGaranti", (c) => (c.fetes.dateLimitePrixGaranti = "2026-12-31")],
      ["fetes.dateFin", (c) => (c.fetes.dateFin = "20/12/2026")],
      ["accueil.chapeau", (c) => (c.accueil.chapeau = "   ")],
      ["questions.groupes", (c) => c.questions.groupes.pop()],
    ];
    for (const [chemin, modifier] of cas) {
      const c = copie();
      modifier(c);
      expect(bloquants(c).some((m) => m.startsWith(chemin)), chemin).toBe(true);
    }
  });

  it("accepte un lien Google Maps et refuse une clé inconnue", () => {
    const c = copie();
    c.coordonnees.lienItineraire = "https://maps.app.goo.gl/AbCdEf123";
    expect(bloquants(c)).toEqual([]);
    expect(bloquants({ ...copie(), inconnu: 1 })).toHaveLength(1);
  });
});

describe("contrôles de publication", () => {
  it("le contenu de la maquette est publiable ; les valeurs « à confirmer » ne sont que des avertissements", () => {
    const r = controlerPublication(CONTENU_INITIAL, A_CONFIRMER_INITIAL);
    expect(r.publiable).toBe(true);
    expect(r.problemes.filter((p) => p.bloquant)).toEqual([]);
    expect(r.problemes.map((p) => p.chemin)).toEqual(A_CONFIRMER_INITIAL);
  });

  it("bloque un « […] » à renseigner, un repère inconnu, une marque incomplète, une ancre inexistante", () => {
    const c = copie();
    c.legal.hebergeur = "[raison sociale et adresse de l’hébergeur à renseigner]";
    c.garanties.elements[1]!.texte = "Devis écrit sous {delais.inconnu}";
    c.pro.chapeau = "Prix fixé pour {conditions.prixFixeSemaines semaines";
    c.livraison.note = "Voir la [formule Cérémonie](#nulle-part).";
    c.ferme.texte = "Une **promesse sans fin";
    expect(bloquants(c)).toEqual([
      "garanties.elements[1].texte : Repère inconnu : {delais.inconnu}.",
      "pro.chapeau : Marque incomplète : « ** », « { » ou « } » sans sa fin.",
      "livraison.note : Lien vers une ancre inexistante : #nulle-part.",
      "ferme.texte : Marque incomplète : « ** », « { » ou « } » sans sa fin.",
      "legal.hebergeur : Texte entre crochets à remplacer (« […] »).",
    ]);
  });

  it("signale une marque « à confirmer » sur un champ disparu", () => {
    const r = controlerPublication(CONTENU_INITIAL, ["prix.inexistant"]);
    expect(r.publiable).toBe(true);
    expect(r.problemes).toEqual([{ chemin: "prix.inexistant", message: "Marque « à confirmer » sur un champ qui n’existe plus.", bloquant: false }]);
  });

  it("chaque chemin « à confirmer » initial existe dans le contenu", () => {
    for (const chemin of A_CONFIRMER_INITIAL) expect(cheminExiste(CONTENU_INITIAL, chemin), chemin).toBe(true);
  });
});

describe("empreinte du contenu", () => {
  it("ne dépend pas de l’ordre des clés et change avec la moindre valeur", () => {
    const a = empreinteContenu({ b: 1, a: { d: [1, 2], c: "x" } });
    expect(empreinteContenu({ a: { c: "x", d: [1, 2] }, b: 1 })).toBe(a);
    expect(empreinteContenu({ a: { c: "x", d: [2, 1] }, b: 1 })).not.toBe(a);
    const c = copie();
    c.prix.vivant += 1;
    expect(empreinteContenu(c)).not.toBe(empreinteContenu(CONTENU_INITIAL));
  });
});

/** Classes que pose le script de tête de la maquette, exécuté hors navigateur à l’instant donné. */
function classesDuScriptDeTete(maintenant: number, limite: string, fin: string): string[] {
  const html = {
    className: "no-js",
    dataset: { fetesDeadline: limite, fetesEnd: fin },
    classList: { add: (c: string) => (html.className += ` ${c}`) },
  };
  class DateFigee extends Date {
    static override now() {
      return maintenant;
    }
  }
  new Function("document", "window", "Date", SCRIPT_TETE)({ documentElement: html }, {}, DateFigee);
  return html.className.split(" ").filter((c) => c.startsWith("fetes-"));
}

describe("état des Fêtes côté serveur", () => {
  it("suit exactement la règle du script de tête, minuit de Douala compris", () => {
    const f = CONTENU_INITIAL.fetes;
    const instants = [
      "2026-10-11T09:00:00Z",
      "2026-10-31T22:59:59Z", // 31 octobre 23:59:59 à Douala
      "2026-10-31T23:00:00Z", // 1er novembre 0 h à Douala
      "2026-11-15T09:00:00Z",
      "2026-12-20T22:59:59Z", // 20 décembre 23:59:59 à Douala
      "2026-12-20T23:00:00Z", // 21 décembre 0 h à Douala
      "2027-01-05T09:00:00Z",
    ].map((t) => Date.parse(t));
    for (const t of instants) {
      const e = etatFetes(f, dateDouala(t));
      const serveur = [e.fin && "fetes-fin", e.garanti && "fetes-garanti"].filter(Boolean);
      expect(serveur, new Date(t).toISOString()).toEqual(classesDuScriptDeTete(t, f.dateLimitePrixGaranti, f.dateFin));
    }
  });

  it("aucune classe quand les Fêtes sont désactivées", () => {
    expect(etatFetes({ ...CONTENU_INITIAL.fetes, actif: false }, "2026-10-11")).toEqual({ fin: false, garanti: false });
  });
});
