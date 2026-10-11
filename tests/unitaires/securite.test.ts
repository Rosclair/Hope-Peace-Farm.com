import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyserEntetesIp, tronquerIp } from "@/lib/diagnostic/ip";
import { codeErreur } from "@/lib/journal";
import { cheminMedia, estDans } from "@/lib/medias/stockage";
import { jetonPorteur, jetonValide } from "@/lib/securite/jeton";

describe("jetons", () => {
  const secret = "s".repeat(40);

  it("accepte le bon jeton, refuse les autres", () => {
    expect(jetonValide(secret, secret)).toBe(true);
    expect(jetonValide(secret.slice(1), secret)).toBe(false);
    expect(jetonValide("", secret)).toBe(false);
    expect(jetonValide(null, secret)).toBe(false);
    expect(jetonValide(secret, "")).toBe(false);
  });

  it("lit l’en-tête Authorization: Bearer", () => {
    expect(jetonPorteur(new Headers({ authorization: `Bearer ${secret}` }))).toBe(secret);
    expect(jetonPorteur(new Headers({ authorization: `Basic ${secret}` }))).toBeNull();
    expect(jetonPorteur(new Headers())).toBeNull();
  });
});

describe("chemins des médias", () => {
  const racine = path.resolve("/srv/televersements");

  it("accepte des noms simples en .webp", () => {
    expect(cheminMedia(racine, ["diagnostic", "sharp-abc123.webp"])).toBe(path.join(racine, "diagnostic", "sharp-abc123.webp"));
    expect(cheminMedia(racine, ["photo-1600.webp"])).toBe(path.join(racine, "photo-1600.webp"));
  });

  it("refuse toute sortie du dossier et tout fichier inattendu", () => {
    for (const segments of [
      [],
      [".."],
      ["..", "secret.webp"],
      ["a", "..", "b.webp"],
      ["..%2fsecret.webp"],
      ["a/b.webp"],
      ["a\\b.webp"],
      [".diagnostic", "persistance.json"],
      ["photo.jpg"],
      ["Photo.webp"],
      ["photo.webp.exe"],
      ["a", "b", "c", "d", "e.webp"],
    ]) {
      expect(cheminMedia(racine, segments), segments.join("/")).toBeNull();
    }
  });

  it("repère un dossier contenu dans un autre", () => {
    expect(estDans(path.resolve("/app/uploads"), path.resolve("/app"))).toBe(true);
    expect(estDans(path.resolve("/app"), path.resolve("/app"))).toBe(true);
    expect(estDans(path.resolve("/home/u/uploads"), path.resolve("/home/u/app"))).toBe(false);
    expect(estDans(path.resolve("/app-bis"), path.resolve("/app"))).toBe(false);
  });
});

describe("adresses IP tronquées", () => {
  it("ne garde que le début de l’adresse", () => {
    expect(tronquerIp("41.202.219.73")).toBe("41.202.x.x");
    expect(tronquerIp(" 41.202.219.73:5123 ")).toBe("41.202.x.x");
    expect(tronquerIp("2c0f:f5c0:440:1::25")).toBe("2c0f:f5c0:…");
    expect(tronquerIp('for="[2c0f:f5c0::1]:443"')).toBe("2c0f:f5c0:…");
    expect(tronquerIp("unknown")).toBe("?");
  });

  it("analyse les en-têtes de proxy sans exposer d’adresse complète", () => {
    const resultat = analyserEntetesIp(
      new Headers({ "x-forwarded-for": "41.202.219.73, 10.0.0.2", forwarded: "for=41.202.219.73;proto=https", "user-agent": "x" }),
    );
    expect(resultat).toEqual({ "x-forwarded-for": ["41.202.x.x", "10.0.x.x"], forwarded: ["41.202.x.x"] });
    expect(JSON.stringify(resultat)).not.toContain("219.73");
  });
});

describe("codes d’erreur", () => {
  it("ne reprend jamais le message de l’erreur", () => {
    const e = Object.assign(new Error("Invalid login for proprietaire@exemple.cm"), { code: "EAUTH", responseCode: 535 });
    expect(codeErreur(e)).toBe("EAUTH · SMTP 535");
    expect(codeErreur(new TypeError("chemin /home/u1234/secret"))).toBe("TypeError");
    expect(codeErreur("texte libre")).toBe("Erreur");
  });
});
