import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { delaiAvantNouvelleTentative, TENTATIVES_MAX } from "@/lib/mail/file";
import { SCRIPT_TETE } from "@/lib/site/script-tete";

describe("script de tête", () => {
  it("est identique à celui de la maquette", () => {
    const reference = readFileSync("reference/extrait/tete.js", "utf8").trim();
    expect(SCRIPT_TETE).toBe(reference);
  });
});

describe("file d’envoi des e-mails", () => {
  it("espace les nouvelles tentatives puis abandonne après la cinquième", () => {
    expect([1, 2, 3, 4].map(delaiAvantNouvelleTentative)).toEqual([1, 5, 15, 60]);
    expect(TENTATIVES_MAX).toBe(5);
    expect(delaiAvantNouvelleTentative(5)).toBeNull();
    expect(delaiAvantNouvelleTentative(9)).toBeNull();
  });
});
