# Suivi du projet

**État : phase 3 terminée et vérifiée en local (12/10/2026) ; en attente du « GO phase 4 ». Code poussé sur GitHub (`origin` : Rosclair/Hope-Peace-Farm.com) ; déploiement par vous ([guide](docs/deploiement-hostinger.md)). Questions ouvertes : 2 et 3 de [docs/risques-et-questions.md §5](docs/risques-et-questions.md#5-questions-3).**

| Phase | Contenu | État |
| --- | --- | --- |
| 0 | Cadrage, extraction, captures et mesures de référence | terminée (11/10/2026) |
| 1 | Squelette déployé sur Hostinger | squelette prêt et vérifié en local (11/10/2026) ; déploiement fait par vous, en attente |
| 2 | Portage fidèle de la page, tests de parité | terminée (12/10/2026), vérifiée en local |
| 3 | Contenus en base, publication, retour arrière | terminée (12/10/2026), vérifiée en local |
| 4 | Formulaires, demandes, e-mail, WhatsApp | — |
| 5 | Back-office : connexion, tableau de bord, demandes, contenus, publication | — |
| 6 | Back-office : listes, photos, campagnes, statistiques, journal | — |
| 7 | SEO, performance, accessibilité, sécurité, recette | — |
| 8 | Mise en production, README, guide du propriétaire | — |

## Phase 3 — fait (contenus en base, publication, retour arrière ; vérifié en local)

- **Schéma Zod du contenu** (`lib/contenu/schema.ts`) : longueurs bornées (au moins 30 % de marge sur la maquette), champs obligatoires, dates des Fêtes cohérentes, numéros au bon format, liens sortants limités aux domaines permis (Facebook, chaîne WhatsApp, Google Maps), 4 groupes de FAQ, messages d’erreur en français. Les types du code en sont déduits (une seule définition).
- **Tables** `contenu_brouillon`, `version_contenu`, `etat_publication` (migration `drizzle/0001_contenu.sql`), colonnes JSON relues aussi bien sur MySQL que sur MariaDB.
- **Dépôt** (`lib/contenu/depot.ts`) : brouillon avec verrou optimiste (révision), publication (contrôles, version immuable, empreinte SHA-256 du JSON canonique, version en ligne), retour arrière (« restaurée depuis la n° X », brouillon remis à la version restaurée), historique ; verrou MySQL `hpf_contenu` + transaction ; journal applicatif sans donnée personnelle.
- **Contrôles de publication** (`lib/contenu/controles.ts`) — bloquants : schéma, champ obligatoire vide, « […] » à remplacer, repère inconnu, marque incomplète, lien vers une ancre inexistante ; avertissements : valeurs « à confirmer » (14 au départ, liste du brief §5).
- **Données initiales** : la maquette est publiée en version n° 1 **automatiquement au premier démarrage** si la base est vide (après les migrations) ; aussi `npm run db:initialiser`.
- **Page publique lue en base**, en cache (`"use cache"`, étiquette `contenu-publie`, profil 30 s / 5 min), avec repli si la base est indisponible : dernier contenu publié gardé dans `UPLOAD_DIR/.contenu/publie.json`, sinon la maquette ; tout contenu relu est revalidé par Zod.
- **Revalidation** (`lib/contenu/revalidation.ts`, route `POST /api/contenu/revalider` protégée par `CRON_SECRET`) : page à jour dès la requête suivante.
- **Fêtes posées par le serveur** (`lib/contenu/fetes.ts`) : bandeau juste aussi sans JavaScript ; bascule de minuit visible dans la minute grâce au profil de cache (plus besoin de tâche dédiée).
- **Ligne de commande** en attendant le back-office : `npm run contenu -- etat | historique | controler | publier | restaurer <n> | exporter <f> | importer <f>` (chargeur TypeScript maison `scripts/lib/chargeur-ts.mjs`, sans nouvelle dépendance).
- **Diagnostic** : `/api/sante` (avec jeton) et `npm run deploiement:verifier` indiquent la version en ligne, l’état du brouillon et l’instantané de secours.
- **Documents** : [architecture](docs/architecture.md) §3, §4, §8, §10 ; [modèle de données](docs/modele-donnees.md) §1 et §10 ; [guide de déploiement](docs/deploiement-hostinger.md) §1 ; [risques](docs/risques-et-questions.md) R16 réglé.

## Phase 3 — décisions

- **Cache de la page : étiquette + durée bornée.** Next garde l’état des étiquettes de revalidation **en mémoire** (documentation « How revalidation works ») : perdu quand Hostinger arrête le processus faute de trafic. Le profil `PROFIL_CONTENU` (régénération en arrière-plan au plus toutes les 30 s, jamais servi au-delà de 5 min ; en dessous de 5 min, Next exclurait la page du pré-rendu) borne donc le retard dans tous les cas. Conséquence : `Cache-Control: s-maxage=30, stale-while-revalidate=270` au lieu d’un an (R16 réglé).
- **Revalidation en deux temps.** Mesuré sur Next 16.4 : `revalidateTag(…, { expire: 0 })` seul laissait servir une fois l’ancienne page (`STALE`) ; et une régénération commencée juste avant la publication pouvait écrire l’ancien contenu après la revalidation (écriture du cache après la réponse) — échec intermittent du test. Retenu : `revalidateTag` + `revalidatePath("/")`, puis de nouveau 2 s plus tard, avant de répondre.
- **Retour arrière = brouillon remis à la version restaurée** (sinon la publication suivante ramènerait l’erreur corrigée) ; l’opération signale si des modifications non publiées ont été remplacées. Publier un brouillon identique à la version en ligne ne crée pas de version.
- **Repli sur instantané disque** plutôt qu’une erreur : si la base est injoignable lors d’un rendu (compilation chez l’hébergeur, panne), la page montre le dernier contenu publié ; la base n’est pas réessayée pendant 30 s (délai de connexion de 10 s).
- **Base de test séparée** `hpf_test` (même utilisateur limité `hpf_dev`) pour les tests d’intégration et de bout en bout ; garde : aucune base dont le nom ne finit pas par `_test`. La base `hopeandpeacefarm` (autre projet) n’a pas été touchée.
- **Reportés** : aperçu du brouillon (`/admin/apercu`) et journal d’audit avec l’auteur → phase 5 (ils exigent la connexion) ; photos sans texte alternatif et avis sans accord écrit dans les contrôles → phase 6.

## Phase 3 — écart avec la maquette (justifié)

| Écart | Raison |
| --- | --- |
| Sans JavaScript, la classe des Fêtes du jour (`fetes-garanti` / `fetes-fin`) est posée par le serveur : la phrase du prix garanti s’affiche (ou le bandeau disparaît) à la bonne date | la maquette ne la pose qu’avec JavaScript ; écart prévu par l’architecture §4 |

## Phase 3 — contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | 0 erreur |
| `npm test` | **73 tests** réussis (7 fichiers), dont : schéma (contenu de la maquette valide ; 12 valeurs mal formées refusées avec le bon chemin ; lien Google Maps accepté, clé inconnue refusée), contrôles de publication (maquette publiable, 14 avertissements ; « […] », repère inconnu, marques incomplètes, ancre inexistante bloqués), empreinte indépendante de l’ordre des clés, **état des Fêtes du serveur identique au script de tête de la maquette exécuté tel quel** (7 instants dont les minuits de Douala), repli de lecture (base → instantané → maquette, version invalide jamais rendue) |
| `npm run test:base` (base `hpf_test`), 3 passages | **8 tests** réussis : initialisation unique, verrou optimiste, document hors schéma refusé, publication et brouillon identique (« inchangée »), publication refusée sans rien changer en ligne, **deux publications simultanées → une seule version**, retour arrière (nouveau numéro, brouillon remis), version déjà en ligne / inconnue |
| `npm run test:e2e` (serveur standalone sur `hpf_test`) | **24 tests** réussis, dont publication : **page à jour dès la requête suivante** (prix de la porte et exemple de devis recalculé), **retour arrière visible aussitôt**, **sans revalidation, page à jour en 33 s** ; tests de publication seuls : 5 passages sur 5 ; classe des Fêtes posée par le serveur à la date du jour |
| Redémarrage du serveur après une publication non revalidée | 1ʳᵉ requête : ancienne page servie pendant la régénération ; 2ᵉ requête (3 s après) : à jour |
| `npm run site:parite` (4 formats × 3 modes, contenu lu en base) | DOM, géométrie (1 111 éléments, au 1/100 px) et textes identiques dans les 12 combinaisons ; **382 captures sur 389 identiques au pixel près** (sans JS 116/116, mouvement réduit 120/121, avec JS 146/152) ; les 7 autres : accueil épinglé à 66 et 97 % (anticrénelage des calques animés, déjà expliqué en phase 2) et 2 px de tuile. Contrôle repassé sans captures sur la compilation finale (seule la route de revalidation avait changé) : 0 écart |
| En-têtes de la page | `Cache-Control: s-maxage=30, stale-while-revalidate=270`, `x-nextjs-cache` `HIT` / `MISS` cohérents |
| `npm run contenu` sur `hpf_dev` | initialisation (version n° 1, 14 « à confirmer »), état, historique, contrôle, export/import, publication, retour arrière |
| Maquette | empreinte SHA-256 inchangée |

## Phase 3 — mesures (local)

Lighthouse 13.5, serveur standalone, contenu lu en base (`reference/mesures/site-phase3-local.json`) : mobile **92** (92, 92, 92), ordinateur 100 ; accessibilité, bonnes pratiques 100 ; SEO 66 (`noindex` volontaire) ; FCP 1,36 s, LCP 2,96 s, TBT 168–184 ms, CLS 0. Inchangé par rapport à la phase 2 (HTML identique à 11 octets près). Une première série avait donné un passage aberrant (74, TBT 686 ms) au milieu de deux à 92 et 90 : rejetée après une seconde série stable.

## Phase 3 — reste à faire

- Une fois en ligne (par vous) : `npm run deploiement:verifier -- <adresse>` doit montrer « contenu publié » OK et, après la première visite, l’instantané de secours.

## Phase 2 — fait (portage fidèle, vérifié en local)

- **Page publique** (`app/page.tsx`) : toutes les sections de la maquette en composants serveur (`components/site/` : cadre, accueil, cérémonies, offres, ferme, demande), mêmes balises, classes, ancres et attributs `data-*` ; rendue statiquement (`○ /`, revalidée chaque jour pour le © de l’année).
- **Contenu** : document typé `ContenuPage` (`lib/contenu/types.ts`) et contenu initial = maquette mot pour mot (`lib/contenu/initial.ts`) ; textes avec repères `{groupe.cle}` (prix, délais, conditions, dates des Fêtes, numéros), `**gras**` et `[lien](#ancre)` ; prix, dates et numéros mis en forme comme la maquette (espaces insécables). Prêt pour la phase 3 (base, Zod, publication). Correspondance mise à jour : [docs/correspondance-sections.md](docs/correspondance-sections.md).
- **CSS** : celui de la maquette, généré (`app/maquette.css`), à deux changements près (polices déclarées par `next/font/local`, même repli ajusté). **Sprite SVG** (logo 13 calques, 24 icônes) généré à l’identique (`lib/site/sprite.ts`). Script de tête inchangé.
- **Moteur** (`lib/moteur/`) : `principal.js` porté en TypeScript, sans React ni dépendance, en deux temps (voir décisions) ; messages WhatsApp dans `lib/whatsapp/messages.ts`.
- **Outils** : `npm run site:parite` (parité maquette / site : DOM, géométrie, textes, captures), `npm run site:demarrage` (délai de démarrage du moteur en conditions mobiles), `npm run moteur:construire` (script en ligne), `npm run test:e2e` (Playwright piloté par Vitest, sans nouvelle dépendance) ; `site:mesures` fiabilisé (un Chrome par passage, nouveaux essais).
- **Documents** : [architecture](docs/architecture.md) §3 à §6 et §13, [correspondance](docs/correspondance-sections.md), [risques](docs/risques-et-questions.md) R4, R6, R17 et accès, [guide de déploiement](docs/deploiement-hostinger.md) §1 (répartition GitHub / Hostinger).

## Phase 2 — décisions

- **Réponse à la question 1 (12/10/2026)** : vous déployez vous-même chez Hostinger ; je pousse seulement sur GitHub.
- **Comportements dans le moteur natif, pas en composants React clients** : formulaires rendus côté serveur (balisage identique à la maquette), comportements portés tels quels ; un seul composant client (`Comportements`, rendu `null`). Fidélité maximale et JavaScript minimal.
- **Moteur en deux temps** (après mesure, voir ci-dessous) : ce qui ne touche qu’aux classes, attributs et variables CSS (Fêtes, menu, section courante, barre fixe, détails, landing, en-tête, apparitions) est compilé en un script en ligne en fin de `<body>`, comme celui de la maquette, qui démarre juste après la première image ; les formulaires (qui écrivent textes et listes) démarrent après l’hydratation. React 19 ne compare pas les attributs à l’hydratation en production et garde l’état des cases (vérifié dans son code). En développement, tout démarre après l’hydratation (sinon React signale les attributs).
- **Nœuds de texte fusionnés** : là où le site produisait plusieurs nœuds de texte voisins (repères, espaces), Chrome décalait le texte de 0,02 à 0,04 px ; ils sont fusionnés, la géométrie est maintenant identique au centième de pixel.
- **En-tête `Cross-Origin-Opener-Policy` retiré** (ajouté en phase 1) : il empêchait Lighthouse de mesurer la page (`NO_NAVSTART` presque à chaque passage ; sans lui, 3 passages valides sur 3). Pas dans la liste du brief ; à réessayer en phase 7 (R17).
- **Année du ©** : fonction `"use cache"` + `cacheLife("days")` (Next 16 interdit `new Date()` hors cache au pré-rendu) ; revalidation exacte au 1er janvier avec les tâches de la phase 3.
- **Classes des Fêtes posées par le serveur** : reportées à la phase 3, avec la revalidation aux dates de bascule (posées au build sans revalidation, elles resteraient fausses après la date limite). Comme dans la maquette, le script de tête les pose.

## Phase 2 — écarts avec la maquette (justifiés)

| Écart | Raison |
| --- | --- |
| « J’aimerais » (apostrophe typographique) dans le message WhatsApp général (menu, accueil, pied de page, barre fixe) | correction permise par le brief |
| Résumé des erreurs des formulaires : espace insécable avant « : » et « ? » (espace simple dans la maquette) | correction permise par le brief |
| Mentions légales : lignes « [… à renseigner] » (responsable, e-mail, hébergeur) masquées tant que la valeur manque | brief §5 : une donnée absente cache son bloc |
| Pas d’`og:image`, de `twitter:card` ni d’`image` dans le JSON-LD | l’image citée par la maquette n’existe pas (R9) ; créée en phase 7 |
| Section 7 de `principal.js` (rappel en console des mentions à renseigner) non reprise | les lignes vides sont masquées, il n’y a plus rien à rappeler |
| Polices en fichiers préchargés (`Link: preload`) au lieu du base64 en ligne | `next/font/local` demandé par le brief ; mêmes fichiers, même repli |
| Next ajoute un `<div hidden>` vide en tête de `<body>` et ses scripts de données | invisibles ; exclus de la comparaison du DOM |

## Phase 2 — contrôles exécutés (serveur standalone local)

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | 0 erreur |
| `npm test` | **59 tests** réussis (5 fichiers), dont : messages WhatsApp et remerciements **identiques à ceux que composent les fonctions de la maquette elles-mêmes** (extraites de `principal.js` et exécutées, 10 cas) ; mise en forme et repères ; contenu initial (aucun repère inconnu, ni « […] », ni apostrophe droite, insécables avant « : ; ? ! ») ; sprite identique à la maquette ; CSS = maquette hors polices ; script en ligne à jour avec ses sources |
| `npm run test:e2e` | **20 tests** réussis, 4 passages de suite : script de tête et démarrage sans erreur ni avertissement ; polices chargées ; **aucune ressource tierce** ; landing, menu et barre fixe **même si le JavaScript de Next est bloqué** ; menu (inert, Échap, focus, fermeture au lien) ; ancres (#devis, #essai, #confidentialite) et **retour arrière sans rechargement** ; Fêtes aux 3 dates (lien et bandeau) ; 3 formulaires (erreurs, bornes de dates, étapes, messages, condoléances, copie, modification, brouillon après rechargement, compteur) ; barre fixe (masquée, visible, pendant la saisie) ; **axe-core : 0 violation** à 393 et 1 280 px ; page sans JavaScript |
| `npm run site:parite`, 4 formats × 3 modes | **DOM identique** (1 627 lignes : balises, attributs, textes), **géométrie identique au 1/100 px** (1 111 éléments), **texte affiché identique** (15 régions), 0 erreur console, message WhatsApp de cérémonie identique |
| Captures pixel par pixel (accueil à 0, 14, 38, 66 et 97 %, chaque section écran par écran, page entière, menu, formulaire) | **384 sur 389 identiques au pixel près** : sans JS 116/116, mouvement réduit 120/121, avec JS 148/152 |
| Les 5 autres | accueil épinglé à 66 et 97 % sur 393 px (6 750 et 8 188 px, soit 2,2 et 2,7 %) et à 97 % sur 768 et 1 280 px (55 et 32 px) : anticrénelage du texte de la carte de suivi et du fil des étapes (calques composités) ; page entière en mouvement réduit à 393 px : 2 px (logo, dernière ligne d’une tuile de 256 px). Géométrie et variables CSS identiques ; rejouée deux fois, la maquette est stable et le site alterne entre deux états, dont l’un **identique au pixel près** : la rastérisation dépend du moment où Next finit l’hydratation. Invisible à l’œil (captures agrandies relues) |
| Mode développement (`next dev`) | moteur démarré après l’hydratation, landing et formulaires actifs, console vide |
| Maquette | empreinte SHA-256 inchangée ; `npm run maquette:extraire` régénère à l’identique `reference/extrait/` |

Rapport détaillé : `reference/parite/rapport.json` (captures et images d’écart régénérables, non versionnées).

## Phase 2 — mesures (local)

**Démarrage du moteur** (`npm run site:demarrage`, médianes de 5 passages, processeur ralenti ×4) :

| Réseau | Page | FCP | Moteur démarré |
| --- | --- | --- | --- |
| 4G lente (150 ms, 1,6 Mbit/s) | maquette | 1 092 ms | 1 726 ms |
| | site, moteur après l’hydratation (1ʳᵉ version) | 1 332 ms | 2 550 ms |
| | site, moteur en ligne (retenu) | 1 328 ms | **1 469 ms** |
| 3G (300 ms, 750 kbit/s) | maquette | 1 492 ms | 2 231 ms |
| | site, moteur après l’hydratation (1ʳᵉ version) | 2 380 ms | 4 207 ms |
| | site, moteur en ligne (retenu) | 2 344 ms | **2 620 ms** |

(Lancé avant la première image, le moteur retardait le premier affichage d’environ 400 ms : il démarre donc juste après.)

**Lighthouse 13.5** (`reference/mesures/site-phase2-local.json`, 3 passages valides chacun) :

| | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile | **92** (88–93) | 100 | 100 | 66 | 1,37 s | 2,86–2,99 s | 166–236 ms | 0 |
| Ordinateur | 100 | 100 | 100 | 66 | 0,34 s | 0,61 s | 5–8 ms | 0 |

- Maquette, mêmes conditions : mobile 85–87, TBT ≈ 520 ms, LCP 1,4 s. Le site bloque moins le fil principal, mais son LCP (`p.hero__lead`, du texte, comme la maquette) attend : 2 CSS bloquants (gain estimé 250 ms) et 80 Ko de HTML en gzip. Objectif 95 : travail de la phase 7 (pistes dans R4).
- SEO 66 attendu : seul échec `is-crawlable` (`noindex` volontaire tant que `SITE_INDEXABLE` ne vaut pas 1).
- **Poids** : HTML 311 Ko bruts, **79 Ko servis (gzip)**, 45 Ko s’il était servi en brotli ; les données RSC (copie de l’arbre pour l’hydratation) en font ≈ 59 %. **JavaScript client** : 6 fichiers, 469 Ko décompressés, **119,5 Ko en brotli** (socle Next/React ≈ 115,8 Ko en phase 1 + formulaires) ; moteur en ligne : 13 Ko bruts, 4,6 Ko en brotli (script de la maquette : 31 Ko, 9 Ko). CSS : 2 fichiers, 12,6 Ko transférés.

## Phase 2 — reste à faire

- ~~Envoi sur GitHub~~ : fait le 12/10/2026 (commit `213f3b4`, dépôt Rosclair/Hope-Peace-Farm.com).
- Une fois le site en ligne : `npm run site:parite -- --site=<adresse>` et PageSpeed Insights.

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
- **En-têtes** : `nosniff`, `Referrer-Policy`, `X-Frame-Options` + `frame-ancestors 'none'`, `COOP` (retiré en phase 2, voir R17), `Permissions-Policy` dès maintenant ; CSP complète en phase 7, HSTS sur le vrai domaine seulement.
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

- Terminer la phase 1 en ligne (par vous) : voir « Phase 1 — reste à faire » ci-dessus.
- Phase 4 (formulaires, demandes, e-mail, WhatsApp) dès le « GO phase 4 ».

## Blocages

- **Déploiement** : fait par vous (réponse à la question 1).
- **Domaine** `hopeandpeacefarm.com` non enregistré (question 2) : sans lui, pas de boîte e-mail chez Hostinger, donc pas d’essai SMTP réel ni de SPF/DKIM.
- Question 3 (hébergement hors du Cameroun) : ne bloque pas le travail technique.
- Réseau du poste très lent (6 à 40 Ko/s, coupures) : levé pour la phase 1, toutes les dépendances sont en cache.
