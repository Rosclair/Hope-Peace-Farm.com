// Publication et retour arrière de bout en bout : le test écrit en base (lib/contenu/depot)
// et lit la page servie. Le serveur testé doit tourner sur la même base de test :
//   DB_NAME=hpf_test PORT=3100 npm run standalone
// Ignoré si la base n’est pas une base de test (nom en « _test »).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerBrouillon, initialiserSiVide, lireBrouillon, lireVersionEnLigne, publier, restaurer } from "@/lib/contenu/depot";
import { empreinteContenu } from "@/lib/contenu/empreinte";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import type { ContenuPage } from "@/lib/contenu/types";
import { base } from "@/lib/db/client";
import { SITE } from "./outils";

const BASE_DE_TEST = (process.env.DB_NAME ?? "").endsWith("_test");
const NBSP = " ";

const page = async () => (await fetch(new URL("/", SITE), { cache: "no-store" })).text();
const revalider = async () => {
  const r = await fetch(new URL("/api/contenu/revalider", SITE), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  expect(r.status).toBe(200);
};
async function modifierEtPublier(modifier: (c: ContenuPage) => void, note: string) {
  const b = await lireBrouillon();
  const donnees = structuredClone(b!.donnees) as ContenuPage;
  modifier(donnees);
  await enregistrerBrouillon({ donnees, aConfirmer: b!.aConfirmer, revisionAttendue: b!.revision, par: "test e2e" });
  const r = await publier({ par: "test e2e", note });
  expect(r.statut).toBe("publiee");
  return r.numero;
}
/** Remet le contenu de la maquette en ligne (et dans le brouillon). */
async function remettreLaMaquette() {
  const v = await lireVersionEnLigne();
  if (v && v.empreinte === empreinteContenu(CONTENU_INITIAL)) return v.numero;
  return modifierEtPublier((c) => Object.assign(c, structuredClone(CONTENU_INITIAL)), "maquette (test)");
}

describe.skipIf(!BASE_DE_TEST)("publication (base de test)", () => {
  let versionMaquette = 0;

  beforeAll(async () => {
    await initialiserSiVide("test e2e");
    versionMaquette = await remettreLaMaquette();
    await revalider();
  });
  afterAll(async () => {
    await remettreLaMaquette();
    await revalider();
    await base().pool.end();
  });

  it("publier met la page à jour dès la requête suivante (revalidation)", async () => {
    expect(await page()).toContain(`door__price">À partir de 3${NBSP}400${NBSP}FCFA<`);
    await modifierEtPublier((c) => (c.prix.pretACuire = 3500), "prix prêt à cuire");
    await revalider();
    const html = await page();
    expect(html).toContain(`door__price">À partir de 3${NBSP}500${NBSP}FCFA<`);
    // Exemple de devis recalculé : 100 × 3 500 = 350 000 ; acompte 50 % = 175 000.
    expect(html).toContain(`350${NBSP}000${NBSP}FCFA`);
    expect(html).toContain(`175${NBSP}000${NBSP}FCFA`);
    expect(html).not.toContain(`door__price">À partir de 3${NBSP}400${NBSP}FCFA<`);
  });

  it("le retour arrière remet l’ancienne version en ligne", async () => {
    const r = await restaurer(versionMaquette, { par: "test e2e" });
    expect(r.statut).toBe("restauree");
    await revalider();
    expect(await page()).toContain(`door__price">À partir de 3${NBSP}400${NBSP}FCFA<`);
  });

  it(
    "sans revalidation explicite, la page suit la base en moins d’une minute",
    async () => {
      await modifierEtPublier((c) => (c.delais.devis = `48${NBSP}h`), "délai de devis");
      const debut = Date.now();
      let html = await page();
      while (!html.includes(`Devis écrit sous 48${NBSP}h`) && Date.now() - debut < 90_000) {
        await new Promise((ok) => setTimeout(ok, 3000));
        html = await page();
      }
      const delai = Date.now() - debut;
      console.log(`Délai sans revalidation : ${Math.round(delai / 1000)} s`);
      expect(html).toContain(`Devis écrit sous 48${NBSP}h`);
      expect(delai).toBeLessThan(60_000);
    },
    120_000,
  );
});
