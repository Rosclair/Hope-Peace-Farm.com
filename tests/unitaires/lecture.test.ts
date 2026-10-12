// Repli de la lecture du contenu publié : base, puis instantané sur disque, puis maquette.
// La base est simulée (vi.mock) ; l’instantané est écrit dans un dossier temporaire.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";

const lireVersionEnLigne = vi.fn();
vi.mock("@/lib/contenu/depot", () => ({ lireVersionEnLigne: () => lireVersionEnLigne() }));

const dossier = mkdtempSync(path.join(tmpdir(), "hpf-lecture-"));
beforeAll(() => {
  process.env.UPLOAD_DIR = dossier;
});
afterAll(() => {
  delete process.env.UPLOAD_DIR;
  rmSync(dossier, { recursive: true, force: true });
});

describe("lecture du contenu publié", () => {
  const modifie = structuredClone(CONTENU_INITIAL);
  modifie.prix.vivant = 3100;

  it("lit la version en ligne en base et en garde un instantané", async () => {
    const { chargerContenuPublie } = await import("@/lib/contenu/lecture");
    lireVersionEnLigne.mockResolvedValueOnce({ numero: 7, donnees: modifie, aConfirmer: [], empreinte: "e".repeat(64), publieLe: new Date() });
    const r = await chargerContenuPublie();
    expect(r).toMatchObject({ source: "base", numero: 7 });
    expect(r.contenu.prix.vivant).toBe(3100);
  });

  it("base injoignable : sert le dernier contenu publié gardé sur disque", async () => {
    const { chargerContenuPublie } = await import("@/lib/contenu/lecture");
    lireVersionEnLigne.mockRejectedValueOnce(Object.assign(new Error("connexion refusée"), { code: "ECONNREFUSED" }));
    const r = await chargerContenuPublie();
    expect(r).toMatchObject({ source: "instantane", numero: 7 });
    expect(r.contenu.prix.vivant).toBe(3100);
  });

  it("sans instantané : sert le contenu de la maquette, sans réessayer la base aussitôt", async () => {
    rmSync(path.join(dossier, ".contenu"), { recursive: true, force: true });
    const { chargerContenuPublie } = await import("@/lib/contenu/lecture");
    lireVersionEnLigne.mockClear();
    const r = await chargerContenuPublie();
    expect(r).toMatchObject({ source: "maquette", numero: null });
    expect(r.contenu).toEqual(CONTENU_INITIAL);
    expect(lireVersionEnLigne).not.toHaveBeenCalled(); // base injoignable il y a moins de 30 s
  });
});

describe("version en ligne invalide", () => {
  it("n’est jamais rendue : repli sur l’instantané ou la maquette", async () => {
    vi.resetModules();
    const { chargerContenuPublie } = await import("@/lib/contenu/lecture");
    lireVersionEnLigne.mockResolvedValueOnce({ numero: 8, donnees: { seo: {} }, aConfirmer: [], empreinte: "f".repeat(64), publieLe: new Date() });
    const r = await chargerContenuPublie();
    expect(r.source).not.toBe("base");
  });
});
