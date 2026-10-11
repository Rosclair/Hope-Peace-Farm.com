# Suivi du projet

**État : phase 1 prête et vérifiée en local ; le déploiement chez Hostinger attend les accès ou son exécution par vous ([guide](docs/deploiement-hostinger.md)). Questions ouvertes : [docs/risques-et-questions.md §5](docs/risques-et-questions.md#5-questions-3).**

| Phase | Contenu | État |
| --- | --- | --- |
| 0 | Cadrage, extraction, captures et mesures de référence | terminée (11/10/2026) |
| 1 | Squelette déployé sur Hostinger | squelette prêt et vérifié en local (11/10/2026) ; déploiement en attente |
| 2 | Portage fidèle de la page, tests de parité | — |
| 3 | Contenus en base, publication, retour arrière | — |
| 4 | Formulaires, demandes, e-mail, WhatsApp | — |
| 5 | Back-office : connexion, tableau de bord, demandes, contenus, publication | — |
| 6 | Back-office : listes, photos, campagnes, statistiques, journal | — |
| 7 | SEO, performance, accessibilité, sécurité, recette | — |
| 8 | Mise en production, README, guide du propriétaire | — |

## Phase 1 — fait (squelette, vérifié en local)

Le déploiement chez Hostinger n’a pas pu être fait : aucun accès (question 1 sans réponse). Tout ce qui ne dépend pas d’un accès est prêt et vérifié sur ce poste, avec le même serveur standalone que Hostinger exécutera.

- **Dépendances** (versions exactes) : next 16.4.0, react et react-dom 19.3.0, drizzle-orm 0.45.4, mysql2 3.24.5, nodemailer 10.1.0, sharp 0.35.5, zod 4.6.6, server-only 0.0.1 ; développement : typescript 6.0.3, @types/node 24.19.2, @types/react et @types/react-dom 19.3.0, @types/nodemailer 8.0.2, drizzle-kit 0.31.11, vitest 5.0.3. `package-lock.json` contient les binaires Linux x64 (SWC de Next, sharp, libvips) que Hostinger installera.
- **Configuration** : `next.config.mjs` en objet (exigence Hostinger), `output: "standalone"`, `cacheComponents` et `partialPrefetching`, en-têtes de sécurité de base, migrations et paquets natifs de sharp copiés dans la sortie standalone ; `tsconfig.json` strict (`noUncheckedIndexedAccess`) ; variables validées par Zod (`lib/config.ts`, modèle `.env.example`).
- **Base** : schéma Drizzle `lib/db/schema/` (tables `email_sortant`, `tache_execution`, `demarrage_serveur`), migration `drizzle/0000_squelette.sql`, appliquée au démarrage du serveur (`instrumentation.ts`, verrou MySQL) ou par `npm run db:migrer`.
- **E-mail** : file d’envoi en base, réservation avant envoi, 5 tentatives espacées (1, 5, 15, 60 min), erreurs consignées par leur seul code.
- **Tâches planifiées** : `POST /api/taches` (jeton `CRON_SECRET`), tâches `emails` et `purge-technique` (quotidienne), minuteur interne de secours (désactivé par défaut).
- **Téléversements** : `UPLOAD_DIR` (absolu, hors du dossier déployé), route `/medias/…` limitée aux fichiers `.webp` aux noms simples, marqueur de persistance réécrit à chaque démarrage.
- **Diagnostic** : `GET /api/sante` (public : « en ligne » ; avec `DIAGNOSTIC_SECRET` : Node, variables, base, migrations, écriture, `UPLOAD_DIR` et persistance, sharp réel, SMTP, tâches, démarrages, en-têtes IP tronqués), `POST /api/sante/email`, page témoin `/diagnostic/cache` + `POST /api/sante/cache`.
- **Scripts** : `scripts/verifier-deploiement.mjs` (contrôle d’un déploiement depuis l’extérieur, OK / ÉCHEC / À VOIR), `scripts/mesures-site.mjs` (Lighthouse et poids du JS client), `scripts/migrer.mjs`, `scripts/copier-standalone.mjs`.
- **Page provisoire** : « Hope & Peace Farm — Site en préparation. », polices de la maquette (`next/font/local`, fichiers identiques, mêmes SHA-256), script de tête de la maquette à l’identique, favicon ; `noindex` et `robots.txt` fermé tant que `SITE_INDEXABLE` ne vaut pas 1.
- **Documents** : [guide de déploiement Hostinger](docs/deploiement-hostinger.md) (ce que dit la documentation Hostinger, étapes, cron, vérifications) ; architecture §8 et §16 et risques R2, R4, R12, R15, R16 mis à jour.

## Phase 1 — décisions

- **Déploiement sans accès** (question 1 sans réponse, option la plus prudente) : je n’ai créé aucun dépôt distant ni rien envoyé sur un compte. Le guide permet au propriétaire de tout faire sans me transmettre de mot de passe ; le vérificateur rend le résultat lisible.
- **Migrations au démarrage** : Hostinger lance lui-même le serveur Next, sans commande préalable possible. `register()` est attendu avant la première requête (documentation Next 16.4) ; une base injoignable n’empêche pas le site de répondre.
- **Une seule horloge pour la file d’e-mails** : celle de la base (voir R15, défaut trouvé et corrigé pendant les contrôles).
- **Diagnostic** : jetons de 32 caractères au moins, comparés en temps constant ; le jeton peut passer dans l’URL pour `GET /api/sante` seulement (contrôle depuis un téléphone) ; à changer après la phase 1.
- **En-têtes** : `nosniff`, `Referrer-Policy`, `X-Frame-Options` + `frame-ancestors 'none'`, `COOP`, `Permissions-Policy` dès maintenant ; CSP complète en phase 7, HSTS sur le vrai domaine seulement.
- **`AGENTS.md`** : Next 16.4 en écrit un (en anglais) à chaque `next dev` ; désactivé (`agentRules: false`), son conseil repris en français dans `CLAUDE.md`.
- **Environnement local** : base `hpf_dev` et utilisateur `hpf_dev` à droits limités (comme chez Hostinger) dans le MySQL 8.4 de Laragon ; la base `hopeandpeacefarm` déjà présente (14 tables en anglais, autre projet) n’a pas été touchée. Mailpit dédié (ports 1026/8026) pour les e-mails. Scripts npm exécutés par Bash (`npm_config_script_shell`) car `cmd.exe` coupe le chemin au `&` ; rien dans `.npmrc`, pour ne pas toucher la compilation chez Hostinger.

## Phase 1 — contrôles exécutés (serveur standalone local)

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` (TypeScript 6.0.3 strict) | 0 erreur |
| `npm test` (Vitest) | 22 tests réussis : configuration, jetons, chemins des médias, IP tronquées, codes d’erreur sans message, délais de la file, script de tête identique à la maquette |
| `npm run build` | réussi (Turbopack) ; la compilation ne touche pas la base ; sortie standalone avec `drizzle/` et libvips |
| Démarrage du serveur standalone | `NODE_ENV=production`, migration appliquée, démarrage inscrit en base (UTC), marqueur de persistance écrit |
| `scripts/verifier-deploiement.mjs --email --taches --cache` (2 passages) | **33 OK · 0 ÉCHEC · 7 À VOIR** (relevés informatifs) |
| sharp dans la sortie standalone | échec au 1er essai (libvips absent de la copie), corrigé par `outputFileTracingIncludes`, puis encodage WebP et image servie depuis `UPLOAD_DIR` |
| E-mail immédiat | défaut trouvé (écart d’horloge base/Node de 15 ms), corrigé ; 5 envois sur 5 ensuite, reçus par Mailpit |
| SMTP coupé | e-mail en attente avec le seul code `ESOCKET`, nouvelle tentative à +60 s, envoyé au passage suivant (2ᵉ tentative) |
| Cron simulé (`POST /api/taches`) et minuteur interne (1 min) | passages inscrits avec leur déclencheur |
| Persistance d’`UPLOAD_DIR` (logique) | « confirmée » après un 2ᵉ build, comme attendu |
| Revalidation de `/diagnostic/cache` | servie depuis le cache, puis nouvelle valeur dès la requête suivant `revalidateTag` |
| Base injoignable au démarrage | page servie (HTTP 200), journal `ECONNREFUSED` seul, diagnostic en échec sur la base |
| Accès sans jeton ou mauvais jeton | 401 sur `/api/taches`, `/api/sante/email`, `/api/sante/cache` ; `/api/sante` ne donne que « en ligne » |
| `/medias/` avec `..`, `%2F`, `.diagnostic`, fichier absent | 404 |
| Chrome (393 × 780) : avec JS, mouvement réduit, sans JS | classes `js motion scrolly` / `js` / `no-js` ; polices chargées ; aucune erreur ni avertissement en console |
| Mode développement (`next dev`) et `npm run db:migrer` | fonctionnent |
| UTF-8 en base | `é` stocké `C3A9` et relu correctement par l’application |
| Maquette | empreinte SHA-256 inchangée (`e041773f…`) |
| Secrets | aucune valeur de `.env` dans les fichiers versionnés ; `.env`, `deploiement.env`, `uploads/` ignorés par Git |

## Phase 1 — mesures (squelette, local)

Détail : `reference/mesures/site-phase1-local.json` (`npm run site:mesures`). Page provisoire, serveur standalone local (compression gzip de Next).

| | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile (3 passages valides) | **98** | 100 | 100 | 54 | 0,77 s | 1,37–1,73 s | 156–171 ms | 0 |
| Ordinateur (4 passages) | 100 | 100 | 100 | 54 | 0,22 s | 0,39–0,52 s | 1–4 ms | 0 |

- **JavaScript client du socle Next/React, sans aucun composant client** : 5 fichiers, 458 537 o décompressés, ~115,8 Ko en brotli (plus 1 fichier `nomodule` de 112,6 Ko que les navigateurs récents ne chargent pas) ; script en ligne 6,7 Ko.
- Fil principal mobile : évaluation de script 317 ms, compilation 68 ms, autres 221 ms, style et mise en page 24 ms. C’est ce socle qui coûte le TBT ; la maquette, elle, perd son temps en mise en page (≈ 1 485 ms). Voir R4.
- SEO 54 attendu : pas de description et `noindex` volontaires sur la page provisoire.
- Le premier passage mobile de Lighthouse échoue systématiquement (`NO_NAVSTART`, problème connu de trace) : ignoré.

## Phase 1 — reste à faire

1. Déploiement (vous, ou moi avec les accès) : étapes 1 à 7 de [docs/deploiement-hostinger.md](docs/deploiement-hostinger.md).
2. `scripts/verifier-deploiement.mjs` sur l’adresse Hostinger ; 2ᵉ déploiement (persistance d’`UPLOAD_DIR`) ; une heure sans visite (mise en veille) ; e-mail réel dès que le domaine et la boîte existent.
3. PageSpeed Insights sur l’adresse publique ; consigner ici les « À VOIR » relevés (cache intermédiaire, en-tête IP, MySQL ou MariaDB).
4. Changer `DIAGNOSTIC_SECRET` une fois ces contrôles faits.

## Phase 0 — fait

- Brief enregistré mot pour mot dans `docs/brief.md`.
- Maquette déplacée dans `reference/hope-and-peace-farm-apercu-2.html`, octet pour octet (SHA-256 `e041773f131b0a279e42e061c2de0de6055b91d96d73011395fa8fe9afa2e054`, identique avant et après ; `.gitattributes` empêche toute conversion de fins de ligne).
- Extraction par script (`scripts/extraire-maquette.mjs`, sans lire le base64) dans `reference/extrait/` :
  - 3 polices WOFF2 (signature vérifiée) : Bricolage Grotesque 800 (21 844 o), Figtree 400 (11 384 o), Figtree 600 (11 544 o) ;
  - logo SVG complet (13 calques `#lg-*`, 26 dégradés) + définitions seules ; favicon ; 24 icônes (sprite + fichiers) ;
  - `styles.css` (1 918 lignes, polices pointant vers les fichiers), `tete.js`, `principal.js` (703 lignes), `jsonld.json`, `structure.html` (page lisible sans données volumineuses), `manifeste.json` (empreintes).
- Captures de référence et mesures (voir ci-dessous).
- Documents : [architecture](docs/architecture.md), [modèle de données](docs/modele-donnees.md), [correspondance sections → composants → champs](docs/correspondance-sections.md), [risques et questions](docs/risques-et-questions.md).
- Outils de développement installés (versions exactes) : Playwright 1.64.0, Lighthouse 13.5.0, @axe-core/playwright 4.13.0, chrome-launcher 1.2.2. Chrome 155 du poste utilisé (pas de téléchargement de navigateur).

## Phase 0 — décisions

Voir aussi [docs/risques-et-questions.md §4](docs/risques-et-questions.md#4-décisions-prises-par-défaut-option-la-plus-prudente).

- Contenu publiable = un document JSON validé par Zod, versionné par instantanés (publication et retour arrière atomiques).
- Tous les textes de la page modifiables, sauf libellés des formulaires, messages WhatsApp pré-remplis, ancres et menu.
- Valeurs citées dans les textes par repères `{groupe.cle}`.
- Formulaires sans JS : vrais `<form method="post">`, redirection vers `/demande/confirmation` (écart voulu avec la maquette).
- Fêtes : classes posées par le serveur au rendu + script de tête + revalidation aux dates de bascule (21/12/2026 0 h et 01/11/2026 0 h, heure de Douala).
- Captures PNG non versionnées (≈ 45 Mo, régénérables par `npm run maquette:captures`) ; leur manifeste (empreintes SHA-256) est versionné. Rapports HTML Lighthouse non versionnés ; `mesures.json` versionné.
- Identité Git locale provisoire : `ieeservices2019` / `ieeservices2019@gmail.com` (à changer si besoin : `git config user.name`).

## Phase 0 — mesures de référence (maquette)

Conditions : Lighthouse 13.5.0, Chrome 155 sans interface, Windows 10, maquette servie en local avec compression brotli (`scripts/lib/serveur-statique.mjs`). Mobile = réglages par défaut (Moto G Power, 4G lente simulée, processeur ×4) ; 3 passages, médiane. Détail : `reference/mesures/mesures.json`.

| | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile | **85–87** (médianes de 2 séries) | 100 | 100 | 63 | 1,1 s | 1,4 s | 517–527 ms | 0,004 |
| Ordinateur | 100 | 100 | 100 | 63 | 0,25 s | 0,33 s | 61–68 ms | 0,0003 |

- **SEO 63** : seul échec `is-crawlable`, dû au `<meta name="robots" content="noindex">` de la maquette (aperçu). Le site en production n’aura pas cette balise.
- **Performance mobile** : seul le temps de blocage pénalise. Fil principal : style et mise en page 1 485 ms, autres 1 040 ms, rendu 248 ms, script 67 ms. Une tâche de 930 ms contient 682 ms de mise en page pour 531 objets.
- **Diagnostic par variantes** (`npm run maquette:diagnostic`, copies de la maquette, `reference/mesures/diagnostic.json`) :

  | Variante | Perf. | TBT |
  | --- | --- | --- |
  | maquette | 86–87 | 513–545 ms |
  | sans logo (`<use>` retirés) | 86 | 623 ms |
  | sans animations (`motion`) | 89 | 449 ms |
  | sans landing épinglée | 86 | 531 ms |
  | sans assemblage du logo | 87 | 511 ms |
  | sans apparitions | 87 | 513 ms |
  | sans réévaluation à `fonts.ready` | 87 | 486 ms |
  | polices de repli seules | 89 | 414 ms |
  | `content-visibility` hors écran | 89 | 429 ms |
  | polices de repli sans `local()` | 92 | 342 ms |
  | sans `local()` + `content-visibility` | **94** | 278 ms |

- **Élément LCP** : mobile `p.hero__lead` (chapeau, texte) ; ordinateur un `<span>` du titre.
- **Poids** : HTML 283 459 o brut, 94 449 o en brotli (dont polices en base64 : 59 700 o) ; JavaScript en ligne 30 947 o brut, 9 008 o en brotli ; polices WOFF2 21 844 + 11 384 + 11 544 o.
- **axe-core** (WCAG 2.0/2.1/2.2 A et AA + bonnes pratiques), 393 et 1 280 px : **0 violation**, 50 règles réussies ; contraste à vérifier à la main sur 21 et 24 nœuds (texte sur dégradé ou image, non calculable automatiquement).
- **Débordement horizontal** : 0 px à 320, 360, 393, 412, 768, 1 024, 1 280, 1 440 et 1 920 px.
- **Hauteur de page** (JS / sans JS / mouvement réduit) : 360 px 21 748 / 19 940 / 21 034 ; 393 px 21 201 / 18 913 / 20 012 ; 768 px 19 141 / 16 166 / 17 109 ; 1 280 px 14 707 / 12 739 / 13 356.
- **Landing épinglée** active sur les 4 formats ; positions capturées exactes (ex. 393 × 780 : 0 ; 0,14 ; 0,3802 ; 0,66 ; 0,97).
- PageSpeed Insights : impossible tant que rien n’est en ligne ; à mesurer dès la phase 1 sur le site déployé.

## Phase 0 — contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| Empreinte de la maquette avant/après rangement | identique (SHA-256 ci-dessus) |
| Extraction : signature `wOF2` des 3 polices, JSON-LD valide, aucun base64 restant dans le CSS ni dans `structure.html` | OK (contrôles intégrés au script) |
| Captures : `npm run maquette:captures` | 403 captures, 41,8 Mo, 464 s ; 0 erreur console dans les 12 combinaisons format × mode |
| Captures relues à l’œil : accueil 0/38/97 % (393), accueil 66 % (1 280), erreurs et succès du formulaire cérémonie, Fêtes terminées, sans JS | conformes à la maquette |
| États des Fêtes (heure figée) | 15/10/2026 : `fetes-garanti`, lien avec garantie ; 15/11/2026 : sans garantie ; 21/12/2026 : `fetes-fin`, bandeau et bloc masqués |
| Message WhatsApp du formulaire cérémonie (référence pour les tests) | « Bonjour Hope & Peace Farm, je prépare des funérailles le 19 décembre 2026 à Bazou, chefferie, près du marché, pour 100 à 200 invités. Je souhaite un devis. Nom : Exemple Test, j’habite à Douala. » (espace insécable avant « : ») |
| Lighthouse (2 séries de 3 passages) et axe-core | voir ci-dessus |
| Domaine `hopeandpeacefarm.com` | non enregistré (DNS : domaine inexistant ; registre Verisign RDAP : 404) |

## Reste à faire

- Terminer la phase 1 en ligne : voir « Phase 1 — reste à faire » ci-dessus.
- Phase 2 (portage fidèle de la page) dès le GO : elle peut commencer avant la fin du déploiement, qui ne la bloque pas.

## Blocages

- **Déploiement** : accès Hostinger et GitHub, ou exécution du guide par vous (question 1).
- **Domaine** `hopeandpeacefarm.com` non enregistré (question 2) : sans lui, pas de boîte e-mail chez Hostinger, donc pas d’essai SMTP réel ni de SPF/DKIM.
- Question 3 (hébergement hors du Cameroun) : ne bloque pas le travail technique.
- Réseau du poste très lent (6 à 40 Ko/s, coupures) : levé pour la phase 1, toutes les dépendances sont en cache.
