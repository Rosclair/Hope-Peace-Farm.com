// Brouillon, publication, retour arrière et historique sur une vraie base (hpf_test).

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ConflitBrouillon,
  ContenuRefuse,
  enregistrerBrouillon,
  historique,
  initialiserSiVide,
  lireBrouillon,
  lireVersionEnLigne,
  publier,
  restaurer,
  VersionIntrouvable,
} from "@/lib/contenu/depot";
import { empreinteContenu } from "@/lib/contenu/empreinte";
import { A_CONFIRMER_INITIAL, CONTENU_INITIAL } from "@/lib/contenu/initial";
import type { ContenuPage } from "@/lib/contenu/types";
import { base, db } from "@/lib/db/client";
import { appliquerMigrations } from "@/lib/db/migrer";

beforeAll(async () => {
  expect(process.env.DB_NAME).toMatch(/_test$/);
  await appliquerMigrations();
});
beforeEach(async () => {
  for (const table of ["version_contenu", "contenu_brouillon", "etat_publication"]) await db().execute(sql.raw(`DELETE FROM ${table}`));
});
afterAll(async () => {
  await base().pool.end();
});

/** Brouillon modifié par `modifier`, enregistré ; renvoie la nouvelle révision. */
async function modifierBrouillon(modifier: (c: ContenuPage) => void, aConfirmer?: string[]) {
  const b = await lireBrouillon();
  if (!b) throw new Error("pas de brouillon");
  const donnees = structuredClone(b.donnees) as ContenuPage;
  modifier(donnees);
  return enregistrerBrouillon({ donnees, aConfirmer: aConfirmer ?? b.aConfirmer, revisionAttendue: b.revision, par: "test" });
}

describe("initialisation", () => {
  it("publie la maquette en version n° 1, une seule fois", async () => {
    expect(await initialiserSiVide("test")).toBe("cree");
    expect(await initialiserSiVide("test")).toBe("existant");
    const v = await lireVersionEnLigne();
    expect(v?.numero).toBe(1);
    expect(v?.donnees).toEqual(CONTENU_INITIAL);
    expect(v?.aConfirmer).toEqual(A_CONFIRMER_INITIAL);
    expect(v?.empreinte).toBe(empreinteContenu(CONTENU_INITIAL));
    const b = await lireBrouillon();
    expect(b?.revision).toBe(1);
    expect(b?.donnees).toEqual(CONTENU_INITIAL);
  });
});

describe("brouillon", () => {
  it("refuse d’écraser une révision plus récente (verrou optimiste)", async () => {
    await initialiserSiVide("test");
    const b = await lireBrouillon();
    await modifierBrouillon((c) => (c.prix.vivant = 3100));
    await expect(
      enregistrerBrouillon({ donnees: b!.donnees, aConfirmer: [], revisionAttendue: b!.revision, par: "autre" }),
    ).rejects.toBeInstanceOf(ConflitBrouillon);
    expect((await lireBrouillon())?.revision).toBe(2);
  });

  it("refuse un document hors schéma", async () => {
    await initialiserSiVide("test");
    const b = await lireBrouillon();
    await expect(
      enregistrerBrouillon({ donnees: { ...(b!.donnees as object), prix: { vivant: -1 } }, aConfirmer: [], revisionAttendue: b!.revision, par: "test" }),
    ).rejects.toBeInstanceOf(ContenuRefuse);
  });
});

describe("publication", () => {
  it("publie une nouvelle version, met la version en ligne à jour et ne republie pas un brouillon identique", async () => {
    await initialiserSiVide("test");
    expect(await publier({ par: "test" })).toEqual({ statut: "inchangee", numero: 1 });
    await modifierBrouillon((c) => (c.prix.pretACuire = 3500), ["prix.vivant"]);
    const r = await publier({ par: "test", note: "nouveaux prix" });
    expect(r).toMatchObject({ statut: "publiee", numero: 2 });
    const v = await lireVersionEnLigne();
    expect(v?.numero).toBe(2);
    expect((v?.donnees as ContenuPage).prix.pretACuire).toBe(3500);
    expect(v?.aConfirmer).toEqual(["prix.vivant"]);
    const h = await historique();
    expect(h.map((l) => [l.numero, l.enLigne, l.note])).toEqual([
      [2, true, "nouveaux prix"],
      [1, false, "Contenu de la maquette"],
    ]);
  });

  it("refuse de publier un brouillon avec des problèmes bloquants, sans rien changer en ligne", async () => {
    await initialiserSiVide("test");
    await modifierBrouillon((c) => (c.legal.hebergeur = "[raison sociale à renseigner]"));
    const erreur = await publier({ par: "test" }).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ContenuRefuse);
    expect((erreur as ContenuRefuse).problemes.filter((p) => p.bloquant).map((p) => p.chemin)).toEqual(["legal.hebergeur"]);
    expect((await lireVersionEnLigne())?.numero).toBe(1);
  });

  it("deux publications simultanées : une seule nouvelle version (verrou)", async () => {
    await initialiserSiVide("test");
    await modifierBrouillon((c) => (c.prix.decoupe = 3700));
    const r = await Promise.all([publier({ par: "a" }), publier({ par: "b" })]);
    expect(r.map((x) => x.statut).sort()).toEqual(["inchangee", "publiee"]);
    expect((await historique()).length).toBe(2);
  });
});

describe("retour arrière", () => {
  it("republie une ancienne version sous un nouveau numéro et y remet le brouillon", async () => {
    await initialiserSiVide("test");
    await modifierBrouillon((c) => (c.prix.vivant = 3100));
    await publier({ par: "test" }); // n° 2
    await modifierBrouillon((c) => (c.prix.vivant = 3200)); // non publié
    const r = await restaurer(1, { par: "test" });
    expect(r).toEqual({ statut: "restauree", numero: 3, depuis: 1, modificationsRemplacees: true });
    const v = await lireVersionEnLigne();
    expect(v?.numero).toBe(3);
    expect(v?.donnees).toEqual(CONTENU_INITIAL);
    expect((await lireBrouillon())?.donnees).toEqual(CONTENU_INITIAL);
    const [derniere] = await historique(1);
    expect(derniere).toMatchObject({ numero: 3, restaureeDepuis: 1, note: "Restaurée depuis la version n° 1", enLigne: true });
  });

  it("restaurer la version déjà en ligne ne crée pas de version ; une version inconnue est refusée", async () => {
    await initialiserSiVide("test");
    expect(await restaurer(1, { par: "test" })).toEqual({ statut: "inchangee", numero: 1, depuis: 1, modificationsRemplacees: false });
    await expect(restaurer(99, { par: "test" })).rejects.toBeInstanceOf(VersionIntrouvable);
    expect((await historique()).length).toBe(1);
  });
});
