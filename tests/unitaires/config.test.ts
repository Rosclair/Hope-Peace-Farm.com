import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigurationIncomplete, configBase, configSecrets, configSite, configSmtp, configTaches, dossierTeleversement } from "@/lib/config";

const env = (valeurs: Record<string, string>) => valeurs as NodeJS.ProcessEnv;

describe("configuration de la base", () => {
  it("lit les variables et applique le port par défaut", () => {
    const c = configBase(env({ DB_HOST: "localhost", DB_NAME: "hpf", DB_USER: "hpf", DB_PASSWORD: "x", DB_PORT: "" }));
    expect(c).toEqual({ DB_HOST: "localhost", DB_PORT: 3306, DB_NAME: "hpf", DB_USER: "hpf", DB_PASSWORD: "x" });
  });

  it("nomme les variables manquantes sans citer de valeur", () => {
    try {
      configBase(env({ DB_HOST: "localhost", DB_PASSWORD: "secret-tres-long" }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigurationIncomplete);
      expect((e as ConfigurationIncomplete).variables).toEqual(["DB_NAME", "DB_USER"]);
      expect((e as Error).message).not.toContain("secret-tres-long");
    }
  });

  it("traite une valeur vide comme absente", () => {
    expect(() => configBase(env({ DB_HOST: " ", DB_NAME: "hpf", DB_USER: "hpf", DB_PASSWORD: "" }))).toThrow(/DB_HOST/);
  });

  it("refuse un port hors limites", () => {
    expect(() => configBase(env({ DB_HOST: "h", DB_NAME: "n", DB_USER: "u", DB_PASSWORD: "", DB_PORT: "70000" }))).toThrow(/DB_PORT/);
  });
});

describe("configuration SMTP", () => {
  const smtp = { SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "contact@exemple.cm", SMTP_PASSWORD: "x", NOTIFICATION_EMAIL: "proprietaire@exemple.cm" };

  it("465 : TLS direct ; expéditeur par défaut = la boîte", () => {
    const c = configSmtp(env(smtp));
    expect(c.port).toBe(465);
    expect(c.securise).toBe(true);
    expect(c.expediteur).toBe('"Hope & Peace Farm" <contact@exemple.cm>');
  });

  it("587 : STARTTLS, sauf indication contraire", () => {
    expect(configSmtp(env({ ...smtp, SMTP_PORT: "587" })).securise).toBe(false);
    expect(configSmtp(env({ ...smtp, SMTP_PORT: "587", SMTP_SECURE: "1" })).securise).toBe(true);
  });

  it("exige une adresse de notification valide", () => {
    expect(() => configSmtp(env({ ...smtp, NOTIFICATION_EMAIL: "pas-une-adresse" }))).toThrow(/NOTIFICATION_EMAIL/);
  });
});

describe("autres réglages", () => {
  it("site non indexable par défaut", () => {
    expect(configSite(env({}))).toEqual({ SITE_URL: "http://localhost:3000", SITE_INDEXABLE: false });
    expect(configSite(env({ SITE_INDEXABLE: "1", SITE_URL: "https://hopeandpeacefarm.com" })).SITE_INDEXABLE).toBe(true);
  });

  it("secrets de 32 caractères au moins", () => {
    expect(() => configSecrets(env({ CRON_SECRET: "court", DIAGNOSTIC_SECRET: "x".repeat(32) }))).toThrow(/CRON_SECRET/);
    expect(configSecrets(env({ CRON_SECRET: "c".repeat(32), DIAGNOSTIC_SECRET: "d".repeat(40) })).DIAGNOSTIC_SECRET).toHaveLength(40);
  });

  it("minuteur des tâches désactivé par défaut", () => {
    expect(configTaches(env({})).TACHES_MINUTEUR_MINUTES).toBe(0);
    expect(configTaches(env({ TACHES_MINUTEUR_MINUTES: "15" })).TACHES_MINUTEUR_MINUTES).toBe(15);
  });
});

describe("dossier des téléversements", () => {
  it("chemin absolu obligatoire en production", () => {
    expect(() => dossierTeleversement(env({}), true)).toThrow(/UPLOAD_DIR/);
    expect(() => dossierTeleversement(env({ UPLOAD_DIR: "uploads" }), true)).toThrow(/UPLOAD_DIR/);
    const absolu = path.resolve("/srv/hpf/televersements");
    expect(dossierTeleversement(env({ UPLOAD_DIR: absolu }), true)).toBe(absolu);
  });

  it("en développement, uploads/ à la racine du projet par défaut", () => {
    expect(dossierTeleversement(env({}), false)).toBe(path.resolve(process.cwd(), "uploads"));
  });
});
