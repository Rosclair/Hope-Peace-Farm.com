// Vérifie un déploiement depuis l’extérieur : chaque hypothèse Hostinger de
// l’architecture (§16) reçoit OK, ÉCHEC ou À VOIR.
//
// Usage :
//   node scripts/verifier-deploiement.mjs https://exemple.hostingersite.com [--email] [--taches] [--cache] [--json=fichier]
// Jetons (jamais en argument, pour ne pas les laisser dans l’historique) :
//   HPF_DIAGNOSTIC_SECRET (obligatoire pour le rapport complet), HPF_CRON_SECRET (pour --taches)
//   par exemple : node --env-file=deploiement.env scripts/verifier-deploiement.mjs …

import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--"))?.replace(/\/+$/, "");
const option = (nom) => args.includes(`--${nom}`);
const fichierJson = args.find((a) => a.startsWith("--json="))?.slice(7);
if (!base) {
  console.error("Usage : node scripts/verifier-deploiement.mjs <url du site> [--email] [--taches] [--cache] [--json=fichier]");
  process.exit(2);
}
const jetonDiagnostic = process.env.HPF_DIAGNOSTIC_SECRET;
const jetonCron = process.env.HPF_CRON_SECRET;

const lignes = [];
const bilan = { OK: 0, "ÉCHEC": 0, "À VOIR": 0 };
function noter(etat, sujet, detail = "") {
  bilan[etat] += 1;
  lignes.push({ etat, sujet, detail });
  console.log(`${etat.padEnd(6)}  ${sujet}${detail ? ` — ${detail}` : ""}`);
}
const ok = (condition, sujet, detail, siNon = "ÉCHEC") => noter(condition ? "OK" : siNon, sujet, detail);

async function requete(chemin, init = {}) {
  const debut = performance.now();
  const reponse = await fetch(chemin.startsWith("http") ? chemin : `${base}${chemin}`, { redirect: "manual", ...init });
  const corps = Buffer.from(await reponse.arrayBuffer());
  return { reponse, corps, ms: Math.round(performance.now() - debut) };
}
const entete = (r, nom) => r.headers.get(nom);
const avecJeton = (jeton) => ({ headers: { authorization: `Bearer ${jeton}` } });

console.log(`Vérification de ${base} — ${new Date().toISOString()}\n`);

// 1. Page d’accueil : réponse, compression, en-têtes de sécurité et de cache.
const accueil = await requete("/", { headers: { "accept-encoding": "br, gzip" } });
ok(accueil.reponse.status === 200, "page d’accueil", `HTTP ${accueil.reponse.status} en ${accueil.ms} ms`);
ok(Boolean(entete(accueil.reponse, "content-encoding")), "compression du HTML", entete(accueil.reponse, "content-encoding") ?? "aucune", "À VOIR");
for (const nom of ["x-content-type-options", "referrer-policy", "x-frame-options", "content-security-policy", "permissions-policy"]) {
  ok(Boolean(entete(accueil.reponse, nom)), `en-tête ${nom}`, entete(accueil.reponse, nom) ?? "absent");
}
ok(!entete(accueil.reponse, "x-powered-by"), "pas d’en-tête x-powered-by", entete(accueil.reponse, "x-powered-by") ?? "");
const html = accueil.corps.toString("utf8");
ok(/<meta name="robots" content="noindex, nofollow"/.test(html), "page en noindex (avant la production)", "", "À VOIR");
noter("À VOIR", "Cache-Control du HTML", entete(accueil.reponse, "cache-control") ?? "absent");
const indicesCache = ["age", "x-cache", "x-litespeed-cache", "x-hcdn-cache-status", "x-hcdn-request-id", "cf-cache-status", "via", "server", "x-turbo-charged-by"]
  .filter((n) => entete(accueil.reponse, n))
  .map((n) => `${n}: ${entete(accueil.reponse, n)}`);
noter("À VOIR", "indices d’un cache intermédiaire", indicesCache.join(" · ") || "aucun");

// 2. Police auto-hébergée : servie par Next avec un cache long.
const police = html.match(/\/_next\/static\/media\/[^"]+\.woff2/)?.[0];
if (police) {
  const r = await requete(police);
  ok(r.reponse.status === 200 && /font\/woff2/.test(entete(r.reponse, "content-type") ?? ""), "police WOFF2 servie", `${police} · ${entete(r.reponse, "cache-control")}`);
} else noter("ÉCHEC", "police WOFF2 préchargée dans le HTML", "aucun lien trouvé");

// 3. HTTPS forcé.
if (base.startsWith("https://")) {
  try {
    const r = await requete(base.replace(/^https:/, "http:") + "/");
    const cible = entete(r.reponse, "location") ?? "";
    ok([301, 302, 307, 308].includes(r.reponse.status) && cible.startsWith("https://"), "redirection http → https", `HTTP ${r.reponse.status} ${cible}`);
  } catch (e) {
    noter("À VOIR", "redirection http → https", e.cause?.code ?? e.message);
  }
  const hsts = entete(accueil.reponse, "strict-transport-security");
  noter("À VOIR", "HSTS (prévu en phase 7, sur le vrai domaine)", hsts ?? "absent");
}

// 4. robots.txt et protection des médias.
const robots = await requete("/robots.txt");
ok(robots.reponse.status === 200 && /Disallow: \//.test(robots.corps.toString()), "robots.txt (tout interdit avant la production)", robots.corps.toString().trim().replace(/\n/g, " | "), "À VOIR");
const traversee = await requete("/medias/..%2f..%2fetc%2fpasswd");
ok(traversee.reponse.status === 404, "médias : sortie du dossier refusée", `HTTP ${traversee.reponse.status}`);

// 5. Diagnostic interne.
const public_ = await requete("/api/sante");
ok(public_.reponse.status === 200 && public_.corps.toString().includes("en_ligne"), "diagnostic public", public_.corps.toString());

let rapport = null;
if (!jetonDiagnostic) {
  noter("À VOIR", "rapport complet", "HPF_DIAGNOSTIC_SECRET non fourni");
} else {
  const r = await requete("/api/sante", avecJeton(jetonDiagnostic));
  try {
    rapport = JSON.parse(r.corps.toString());
  } catch {
    rapport = null;
  }
  if (!rapport?.node) {
    noter("ÉCHEC", "rapport complet", `HTTP ${r.reponse.status} : jeton refusé ou réponse inattendue`);
  } else {
    const { node, environnement, base: bd, televersement: tv, sharp, smtp, requete: rq } = rapport;
    ok(/^v2[24]\./.test(node.version), "version de Node", `${node.version} · ${node.plateforme}`);
    ok(node.environnement === "production", "NODE_ENV à l’exécution", String(node.environnement));
    noter("À VOIR", "processus", `build ${node.build} · dossier ${node.dossier} · port ${node.port} · ${node.memoireMo.rss} Mo · démarré depuis ${node.dureeFonctionnementS} s`);
    for (const [domaine, validation] of Object.entries(environnement.validations)) {
      ok(validation === true, `variables « ${domaine} »`, validation === true ? "" : (validation.variables ?? []).join(", ") || validation.erreur);
    }
    if (bd.ok !== undefined && bd.serveur) {
      ok(bd.ok, "base de données", `${bd.serveur.version} · fuseau ${bd.serveur.fuseau} · ${bd.serveur.jeu}/${bd.serveur.collation} · ${bd.latenceMs} ms`);
      ok(bd.migrations.appliquees === bd.migrations.attendues, "migrations", `${bd.migrations.appliquees}/${bd.migrations.attendues}`);
      const crons = bd.dernieresTaches.filter((t) => t.declencheur === "cron");
      const dernierCron = crons[0] ? new Date(crons[0].debutLe) : null;
      const recent = dernierCron && Date.now() - dernierCron.getTime() < 20 * 60_000;
      ok(Boolean(recent), "cron (passage depuis moins de 20 min)", dernierCron ? `dernier : ${dernierCron.toISOString()} (${crons[0].statut})` : "aucun passage", "À VOIR");
      noter("À VOIR", "démarrages récents", bd.derniersDemarrages.map((d) => `${d.le} ${d.build}`).join(" · "));
      noter("À VOIR", "file des e-mails", JSON.stringify(bd.emails));
    } else ok(false, "base de données", bd.variables?.join(", ") ?? bd.erreur);

    if (tv.chemin) {
      ok(tv.ok, "UPLOAD_DIR accessible en écriture", `${tv.chemin} · ${tv.espaceLibreMo} Mo libres${tv.avertissements.length ? " · " + tv.avertissements.join(" ; ") : ""}`);
      ok(tv.persistance.confirmee, "UPLOAD_DIR conservé après un déploiement", `builds vus : ${tv.persistance.buildsVus.map((b) => b.build).join(", ")}`, "À VOIR");
    } else ok(false, "UPLOAD_DIR", tv.variables?.join(", ") ?? tv.erreur);

    if (sharp.versions) {
      ok(sharp.ok, "sharp (module natif)", `sharp ${sharp.versions.sharp} · libvips ${sharp.versions.vips} · ${sharp.plateforme}`);
      if (sharp.image) {
        const r = await requete(sharp.image);
        ok(r.reponse.status === 200 && entete(r.reponse, "content-type") === "image/webp", "image WebP servie depuis UPLOAD_DIR", `${sharp.image} · ${r.corps.length} o · ${entete(r.reponse, "cache-control")}`);
      } else noter("ÉCHEC", "image WebP écrite dans UPLOAD_DIR");
    } else ok(false, "sharp (module natif)", [sharp.erreur, sharp.plateforme, sharp.message].filter(Boolean).join(" · "));

    ok(smtp.ok, "SMTP (connexion et authentification)", smtp.ok ? `${smtp.hote}:${smtp.port}` : (smtp.variables?.join(", ") ?? smtp.erreur));
    noter("À VOIR", "en-têtes IP reçus (adresses tronquées)", JSON.stringify(rq.ip) + ` · proto ${rq.protocole} · via ${rq.via}`);
    noter("À VOIR", "en-têtes de requête reçus", rq.entetes.join(", "));
  }
}

// 6. Options : e-mail de test, passage des tâches, cache et revalidation.
if (option("email")) {
  if (!jetonDiagnostic) noter("À VOIR", "e-mail de test", "HPF_DIAGNOSTIC_SECRET non fourni");
  else {
    const r = await requete("/api/sante/email", { method: "POST", ...avecJeton(jetonDiagnostic) });
    ok(r.reponse.status === 200, "e-mail de test envoyé (vérifier la réception, et le dossier indésirables)", r.corps.toString());
  }
}
if (option("taches")) {
  if (!jetonCron) noter("À VOIR", "passage des tâches", "HPF_CRON_SECRET non fourni");
  else {
    const r = await requete("/api/taches", { method: "POST", ...avecJeton(jetonCron) });
    ok(r.reponse.status === 200, "passage des tâches (POST /api/taches)", r.corps.toString());
  }
}
if (option("cache")) {
  const horodatage = async () => (await requete("/diagnostic/cache")).corps.toString().match(/data-horodatage="([^"]+)"/)?.[1] ?? null;
  const t1 = await horodatage();
  const t2 = await horodatage();
  ok(Boolean(t1) && t1 === t2, "page en cache (deux lectures identiques)", `${t1} / ${t2}`);
  if (!jetonDiagnostic) noter("À VOIR", "revalidation à la demande", "HPF_DIAGNOSTIC_SECRET non fourni");
  else {
    const r = await requete("/api/sante/cache", { method: "POST", ...avecJeton(jetonDiagnostic) });
    const debut = Date.now();
    let t3 = await horodatage();
    while (t3 === t1 && Date.now() - debut < 60_000) {
      await new Promise((ok) => setTimeout(ok, 2_000));
      t3 = await horodatage();
    }
    ok(r.reponse.status === 200 && t3 !== t1, "revalidation à la demande visible en moins d’une minute", `${t3} après ${Math.round((Date.now() - debut) / 1000)} s`);
  }
}

console.log(`\nBilan : ${bilan.OK} OK · ${bilan["ÉCHEC"]} ÉCHEC · ${bilan["À VOIR"]} À VOIR`);
if (fichierJson) {
  writeFileSync(fichierJson, JSON.stringify({ base, le: new Date().toISOString(), lignes, rapport }, null, 2));
  console.log(`Rapport enregistré dans ${fichierJson}`);
}
process.exit(bilan["ÉCHEC"] > 0 ? 1 : 0);
