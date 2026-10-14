// Better Auth (architecture §9) : e-mail + mot de passe (scrypt), second facteur TOTP
// obligatoire avec 10 codes de secours chiffrés, sessions en base.
//
// Aucune route HTTP de Better Auth n’est exposée : le back-office l’appelle seulement
// côté serveur (auth.api.*), depuis ses actions serveur, qui ajoutent le verrouillage
// après 5 échecs et la limite de débit (lib/auth/connexion.ts). Pas d’inscription
// publique : le premier compte est créé par `npm run admin:creer`, les suivants par
// invitation.
//
// Données personnelles : l’adresse IP n’est jamais stockée (suivi désactivé ; la
// session reçoit une empreinte HMAC à sel quotidien) et l’agent du navigateur est
// remplacé par un résumé (« Chrome · Android »).

import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { configAuth, configDemandes, configSite } from "@/lib/config";
import { db } from "@/lib/db/client";
import { compte, deuxFacteurs, session, utilisateur, verification } from "@/lib/db/schema";
import { adresseVisiteur, empreinte } from "@/lib/demandes/antispam";
import { resumeAppareil } from "./appareil";

export const NOM_APPLICATION = "Hope & Peace Farm";
/** Durée d’une session : 7 jours, prolongée d’un jour à chaque utilisation. */
const SESSION_SECONDES = 7 * 24 * 3600;

/** Empreinte de l’adresse du visiteur (null si l’en-tête n’est pas fiable). */
export function empreinteIp(entetes: Headers | null | undefined): string | null {
  if (!entetes) return null;
  const c = configDemandes();
  const adresse = adresseVisiteur(entetes, c.entete, c.proxys);
  return adresse ? empreinte(`ip:${adresse}`, c.secret()) : null;
}

function creer() {
  return betterAuth({
    appName: NOM_APPLICATION,
    baseURL: configSite().SITE_URL,
    basePath: "/api/auth",
    secret: configAuth().AUTH_SECRET,
    database: drizzleAdapter(db(), {
      provider: "mysql",
      schema: { user: utilisateur, session, account: compte, verification, twoFactor: deuxFacteurs },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "equipe" },
        actif: { type: "boolean", input: false, defaultValue: true },
        echecsConnexion: { type: "number", input: false, defaultValue: 0, returned: false },
        verrouilleJusqua: { type: "date", input: false, required: false, returned: false },
      },
    },
    session: {
      expiresIn: SESSION_SECONDES,
      updateAge: 24 * 3600,
      // Pas de cache de session dans un cookie : une révocation prend effet aussitôt.
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: {
      cookiePrefix: "hpf",
      ipAddress: { disableIpTracking: true },
      database: { generateId: "uuid" },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (s, ctx) => {
            const entetes = ctx?.headers ?? ctx?.request?.headers ?? null;
            return {
              data: {
                ...s,
                ipAddress: empreinteIp(entetes),
                userAgent: resumeAppareil(entetes?.get("user-agent")),
              },
            };
          },
        },
      },
    },
    plugins: [
      twoFactor({
        issuer: NOM_APPLICATION,
        backupCodeOptions: { amount: 10, length: 10 },
        // Sécurité supplémentaire : le verrouillage du back-office (5 échecs) agit avant.
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
        twoFactorCookieMaxAge: 600,
      }),
      // En dernier : pose les cookies de Better Auth depuis les actions serveur.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof creer>;
const global_ = globalThis as typeof globalThis & { __hpfAuth?: Auth };

/** Instance partagée, créée à la première utilisation (la configuration est lue à ce moment). */
export function auth(): Auth {
  global_.__hpfAuth ??= creer();
  return global_.__hpfAuth;
}
