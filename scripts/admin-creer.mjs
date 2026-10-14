#!/usr/bin/env node
// Crée un compte Propriétaire du back-office (le premier, ou un secours si tous les
// codes sont perdus). Pas d’inscription publique : les membres suivants sont invités
// depuis le back-office (Sécurité → Équipe).
//
//   npm run admin:creer -- <email> "<Prénom Nom>"
//
// Le mot de passe provisoire est tiré au hasard et affiché une seule fois. À la
// première connexion, le back-office impose l’activation du second facteur (TOTP).
// Avec --reinitialiser : si le compte existe, nouveau mot de passe provisoire, second
// facteur désactivé (à réactiver à la connexion) et sessions fermées.

import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const reinitialiser = args.includes("--reinitialiser");
const [email, nom] = args.filter((a) => !a.startsWith("--"));

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!reinitialiser && !nom?.trim())) {
  console.error('Usage : npm run admin:creer -- <email> "<Prénom Nom>" [--reinitialiser]');
  process.exit(2);
}

const { appliquerMigrations } = await import("@/lib/db/migrer");
const { creerCompte, CompteExistant } = await import("@/lib/auth/comptes");
const { ecrireAudit } = await import("@/lib/audit");
const { auth } = await import("@/lib/auth/serveur");
const { base, db } = await import("@/lib/db/client");
const schema = await import("@/lib/db/schema");
const { eq } = await import("drizzle-orm");

// Mot de passe provisoire : 20 caractères lisibles (sans 0/O/1/l/I).
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const provisoire = [...randomBytes(20)].map((o) => ALPHABET[o % ALPHABET.length]).join("");

try {
  await appliquerMigrations();
  const [existant] = await db().select().from(schema.utilisateur).where(eq(schema.utilisateur.email, email.toLowerCase())).limit(1);
  if (existant && reinitialiser) {
    const ctx = await auth().$context;
    await ctx.internalAdapter.updatePassword(existant.id, await ctx.password.hash(provisoire));
    await db().delete(schema.deuxFacteurs).where(eq(schema.deuxFacteurs.userId, existant.id));
    await db().delete(schema.session).where(eq(schema.session.userId, existant.id));
    await db()
      .update(schema.utilisateur)
      .set({ twoFactorEnabled: false, actif: true, echecsConnexion: 0, verrouilleJusqua: null, role: "proprietaire" })
      .where(eq(schema.utilisateur.id, existant.id));
    await ecrireAudit({ utilisateurId: null, action: "compte.reinitialiser", cibleType: "utilisateur", cibleId: existant.id, apres: { par: "ligne de commande" } });
    console.log(`Compte réinitialisé : ${existant.email}`);
  } else {
    const id = await creerCompte({ email, nom: nom ?? email, role: "proprietaire", motDePasse: provisoire });
    await ecrireAudit({ utilisateurId: null, action: "compte.creer", cibleType: "utilisateur", cibleId: id, apres: { role: "proprietaire", par: "ligne de commande" } });
    console.log(`Compte Propriétaire créé : ${email.toLowerCase()}`);
  }
  console.log(`Mot de passe provisoire (affiché une seule fois) : ${provisoire}`);
  console.log("À la première connexion sur /admin : activation du second facteur, puis changement du mot de passe (Sécurité).");
} catch (e) {
  if (e instanceof CompteExistant) {
    console.error("Un compte existe déjà avec cette adresse. Ajoutez --reinitialiser pour lui donner un nouveau mot de passe provisoire.");
    process.exitCode = 1;
  } else {
    console.error(`Échec : ${e?.code ?? e?.name ?? "erreur"}`);
    process.exitCode = 1;
  }
} finally {
  await base().pool.end();
}
