#!/usr/bin/env node
// Contenu de la page en ligne de commande, en attendant le back-office (phase 5).
// Mêmes fonctions que celui-ci (lib/contenu/depot.ts), sur la base de .env.
//
//   npm run contenu -- etat                       version en ligne, brouillon, à confirmer
//   npm run contenu -- historique [nombre]        versions publiées
//   npm run contenu -- controler                  contrôles de publication du brouillon
//   npm run contenu -- publier [--note=texte]     publie le brouillon
//   npm run contenu -- restaurer <n> [--note=…]   republie la version n (et y remet le brouillon)
//   npm run contenu -- exporter <fichier.json>    écrit le brouillon dans un fichier
//   npm run contenu -- importer <fichier.json>    remplace le brouillon (révision vérifiée)
//   npm run contenu -- initialiser                contenu de la maquette si la base est vide
//
// Après publier ou restaurer, la page est revalidée par POST /api/contenu/revalider
// (SITE_URL et CRON_SECRET de .env) ; sans réponse du site, elle suit la base en 30 s à 5 min.

import { readFileSync, writeFileSync } from "node:fs";

const [commande, ...reste] = process.argv.slice(2);
const options = Object.fromEntries(reste.filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "").split("=")));
const positionnels = reste.filter((a) => !a.startsWith("--"));
const PAR = "ligne de commande";

const depot = await import("@/lib/contenu/depot");
const { controlerPublication } = await import("@/lib/contenu/controles");
const { empreinteContenu } = await import("@/lib/contenu/empreinte");
const { base } = await import("@/lib/db/client");

const date = (d) => new Date(d).toLocaleString("fr-FR", { timeZone: "Africa/Douala" });

function afficherProblemes(problemes) {
  const bloquants = problemes.filter((p) => p.bloquant);
  const avertissements = problemes.filter((p) => !p.bloquant);
  for (const p of bloquants) console.log(`  ✗ ${p.chemin || "(document)"} : ${p.message}`);
  if (avertissements.length) console.log(`  ${avertissements.length} avertissement(s) : ${avertissements.map((p) => p.chemin).join(", ")}`);
  return bloquants.length;
}

async function revalider() {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  try {
    const r = await fetch(new URL("/api/contenu/revalider", site), {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      signal: AbortSignal.timeout(10_000),
    });
    console.log(r.ok ? `Page revalidée (${site}).` : `Revalidation refusée (HTTP ${r.status}) : la page suivra en 30 s à 5 min.`);
  } catch {
    console.log(`Site injoignable (${site}) : la page suivra la base en 30 s à 5 min après le démarrage.`);
  }
}

try {
  switch (commande) {
    case "etat": {
      const enLigne = await depot.lireVersionEnLigne();
      const brouillon = await depot.lireBrouillon();
      if (!enLigne || !brouillon) {
        console.log("Contenu non initialisé (npm run contenu -- initialiser).");
        break;
      }
      console.log(`Version en ligne : n° ${enLigne.numero}, publiée le ${date(enLigne.publieLe)} (${enLigne.empreinte.slice(0, 12)}…)`);
      const identique = empreinteContenu(brouillon.donnees) === enLigne.empreinte;
      console.log(`Brouillon : révision ${brouillon.revision}, modifié le ${date(brouillon.modifieLe)} par ${brouillon.modifiePar} — ${identique ? "identique à la version en ligne" : "modifications non publiées"}`);
      console.log(`À confirmer (${brouillon.aConfirmer.length}) : ${brouillon.aConfirmer.join(", ") || "aucun"}`);
      break;
    }
    case "historique": {
      for (const v of await depot.historique(Number(positionnels[0] ?? 20))) {
        const origine = v.restaureeDepuis ? ` ← restaurée depuis n° ${v.restaureeDepuis}` : "";
        console.log(`${v.enLigne ? "●" : " "} n° ${String(v.numero).padStart(3)}  ${date(v.publieLe)}  ${v.publiePar}${origine}${v.note ? ` — ${v.note}` : ""}`);
      }
      break;
    }
    case "controler": {
      const brouillon = await depot.lireBrouillon();
      if (!brouillon) throw new Error("Aucun brouillon.");
      const r = controlerPublication(brouillon.donnees, brouillon.aConfirmer);
      console.log(r.publiable ? "Brouillon publiable." : "Brouillon NON publiable :");
      afficherProblemes(r.problemes);
      process.exitCode = r.publiable ? 0 : 1;
      break;
    }
    case "publier": {
      const r = await depot.publier({ par: PAR, note: options.note });
      if (r.statut === "inchangee") console.log(`Rien à publier : le brouillon est identique à la version en ligne (n° ${r.numero}).`);
      else {
        console.log(`Version n° ${r.numero} publiée.`);
        afficherProblemes(r.avertissements);
        await revalider();
      }
      break;
    }
    case "restaurer": {
      const numero = Number(positionnels[0]);
      if (!Number.isInteger(numero) || numero < 1) throw new Error("Numéro de version attendu : npm run contenu -- restaurer <n>");
      const r = await depot.restaurer(numero, { par: PAR, note: options.note });
      console.log(r.statut === "restauree" ? `Version n° ${r.depuis} republiée sous le n° ${r.numero}.` : `La version n° ${r.depuis} est déjà en ligne (n° ${r.numero}).`);
      if (r.modificationsRemplacees) console.log("Le brouillon contenait des modifications non publiées : remplacées par la version restaurée.");
      if (r.statut === "restauree") await revalider();
      break;
    }
    case "exporter": {
      const brouillon = await depot.lireBrouillon();
      if (!brouillon || !positionnels[0]) throw new Error("Usage : npm run contenu -- exporter <fichier.json>");
      writeFileSync(positionnels[0], JSON.stringify({ revision: brouillon.revision, aConfirmer: brouillon.aConfirmer, donnees: brouillon.donnees }, null, 2) + "\n");
      console.log(`Brouillon (révision ${brouillon.revision}) écrit dans ${positionnels[0]}.`);
      break;
    }
    case "importer": {
      if (!positionnels[0]) throw new Error("Usage : npm run contenu -- importer <fichier.json>");
      const f = JSON.parse(readFileSync(positionnels[0], "utf8"));
      const r = await depot.enregistrerBrouillon({ donnees: f.donnees, aConfirmer: f.aConfirmer ?? [], revisionAttendue: f.revision, par: PAR });
      console.log(`Brouillon enregistré (révision ${r.revision}). Publication : npm run contenu -- publier`);
      break;
    }
    case "initialiser": {
      console.log((await depot.initialiserSiVide(PAR)) === "cree" ? "Contenu de la maquette publié en version n° 1." : "Contenu déjà initialisé : rien à faire.");
      break;
    }
    default:
      console.log("Commandes : etat, historique [n], controler, publier [--note=…], restaurer <n> [--note=…], exporter <f>, importer <f>, initialiser");
      process.exitCode = commande ? 1 : 0;
  }
} catch (e) {
  console.error(`Erreur : ${e.message}`);
  if (e.problemes) afficherProblemes(e.problemes);
  process.exitCode = 1;
} finally {
  await base().pool.end();
}
