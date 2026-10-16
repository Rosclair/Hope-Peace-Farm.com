# Suivi du projet

**État : phase 5 terminée et vérifiée en local (14/10/2026) ; en attente du « GO phase 6 ». À faire de votre côté au déploiement : `AUTH_SECRET` et premier compte ([guide](docs/deploiement-hostinger.md) §4 et §6). Texte de confidentialité toujours **à valider** ([projet](docs/confidentialite-projet.md)). Questions ouvertes : 2 et 3 de [docs/risques-et-questions.md §5](docs/risques-et-questions.md#5-questions-3).**

| Phase | Contenu | État |
| --- | --- | --- |
| 0 | Cadrage, extraction, captures et mesures de référence | terminée (11/10/2026) |
| 1 | Squelette déployé sur Hostinger | squelette prêt et vérifié en local (11/10/2026) ; déploiement fait par vous, en attente |
| 2 | Portage fidèle de la page, tests de parité | terminée (12/10/2026), vérifiée en local |
| 3 | Contenus en base, publication, retour arrière | terminée (12/10/2026), vérifiée en local |
| 4 | Formulaires, demandes, e-mail, WhatsApp | terminée (14/10/2026), vérifiée en local |
| 5 | Back-office : connexion, tableau de bord, demandes, contenus, publication | terminée (14/10/2026), vérifiée en local |
| 6 | Back-office : listes, photos, campagnes, statistiques, journal | — |
| 7 | SEO, performance, accessibilité, sécurité, recette | — |
| 8 | Mise en production, README, guide du propriétaire | — |

## Phase 5 — fait (back-office : connexion, tableau de bord, demandes, contenus, publication ; vérifié en local)

- **Connexion** (`/admin/connexion`) : e-mail et mot de passe (scrypt, Better Auth 1.7.7), puis code TOTP à 6 chiffres ou code de secours. **TOTP obligatoire** : à la première connexion, page d’activation imposée (QR code SVG généré côté serveur par `uqr`, clé à saisir à la main, **10 codes de secours** affichés une fois, premier code pour confirmer). **Verrouillage** après 5 échecs consécutifs (mot de passe et code confondus) : 15 min, puis durée doublée à chaque nouvel échec, 24 h au plus ; plus 30 essais par heure et par empreinte d’adresse. Les messages ne disent pas si l’e-mail existe.
- **Comptes** : pas d’inscription publique. Premier Propriétaire par `npm run admin:creer -- <email> "<Prénom Nom>"` (mot de passe provisoire tiré au hasard, affiché une fois ; `--reinitialiser` en secours : nouveau mot de passe, second facteur à refaire, sessions fermées). Membres suivants **par invitation** (Sécurité → Équipe : lien à usage unique valable 7 jours, envoyé par e-mail et affiché pour être transmis autrement ; seule l’empreinte du jeton est gardée). Désactivation d’un compte (ferme ses sessions ; jamais soi-même ni le dernier propriétaire).
- **Rôles** vérifiés côté serveur dans chaque page et chaque action : Propriétaire (tout), Équipe (tableau de bord, demandes, sa propre sécurité).
- **Sécurité** : sessions actives (appareil résumé « Chrome · Android », dates) et révocation, une par une ou toutes les autres ; changement de mot de passe (12 caractères au moins, ferme les autres sessions) ; nouveaux codes de secours.
- **Tableau de bord** : nouvelles demandes, à relancer (plus de 24 h sans changement de statut), e-mails en échec, valeurs « à confirmer », brouillon non publié, dernières modifications.
- **Demandes** : liste filtrable (statut, « à relancer », type, source, dates, recherche par référence, nom ou numéro), pagination ; fiche complète (réponses lisibles, message proposé, source, accord et sa date) ; **statuts avec historique** (les 7 du brief) ; **notes internes** ; **« Écrire sur WhatsApp »** (noté dans l’historique, message « Bonjour …, au sujet de votre demande HP-… ») ; **correction** du nom et du numéro ; **export CSV** (UTF-8 avec BOM, point-virgule, CRLF, formules neutralisées) ; **suppression des données d’un client** (toutes les demandes de son numéro, page de confirmation et case à cocher, journal sans la donnée).
- **Contenus** : les 22 groupes du document de contenu (toutes les valeurs et tous les textes de la page). Champs **déduits du schéma Zod** (obligatoire, longueur maximale avec compteur, bornes, dates, choix), libellé et aide par champ, **rendu final** sous les textes à repères `{…}`, **badge et case « à confirmer »** par champ, erreurs rapportées au champ, verrou optimiste. **Numéro WhatsApp et numéros MTN / Orange : ressaisie du code TOTP, e-mail d’alerte, journal masqué.**
- **Publier** : ce qui va changer (différences avec la version en ligne, valeurs sensibles masquées), contrôles bloquants avec liens vers les champs, avertissements « à confirmer », publication (page publique à jour dès la requête suivante), **aperçu du brouillon** (`/admin/apercu`, mêmes composants que le site, bandeau « Aperçu du brouillon »), historique et **retour arrière** confirmé.
- **Réglages** : e-mail de notification (code TOTP, alerte à l’ancienne et à la nouvelle adresse et aux propriétaires, journal masqué) et durée de conservation des demandes (utilisée par la purge quotidienne).
- **Journal d’audit** (table `journal_audit`) : connexions, échecs, verrouillages, déconnexions, contenus (avant et après des champs modifiés), publications, retours arrière, statuts, notes (sans leur texte), corrections (noms des champs seulement), exports, suppressions (nombre seulement), réglages, sessions, comptes. Valeurs sensibles masquées (`+237 6•• •• 55 65`, `i•••@gmail.com`), adresse remplacée par son empreinte. Page de consultation : phase 6.
- **Base** : migration `drizzle/0003_back_office.sql` (`utilisateur`, `session`, `compte`, `verification`, `deux_facteurs`, `invitation`, `journal_audit`, `reglage`), appliquée au démarrage.
- **Configuration** : `AUTH_SECRET` (obligatoire pour `/admin`, à ne jamais changer) ; `NOTIFICATION_EMAIL` et `DEMANDES_CONSERVATION_MOIS` deviennent des valeurs de départ, modifiables dans Réglages.
- **Documents** : [architecture](docs/architecture.md) §9 « Réalisation (phase 5) », [modèle de données](docs/modele-donnees.md) §2 et §6, [guide de déploiement](docs/deploiement-hostinger.md) §4 et §6 (premier compte), `.env.example`, CLAUDE.md.

## Phase 5 — décisions

- **Better Auth appelé seulement côté serveur** (`auth.api.*` dans les actions) : aucune route `/api/auth` exposée, donc aucun moyen de contourner le verrouillage, la limite de débit ou le journal. Suivi d’adresse de Better Auth désactivé ; la session reçoit l’empreinte HMAC (même sel quotidien que les demandes) et un résumé de l’appareil à la place de l’agent.
- **`AUTH_SECRET` obligatoire et distinct** (pas dérivé de `CRON_SECRET`, contrairement à `DEMANDES_SECRET`) : il chiffre les secrets TOTP ; un secret dérivé changerait avec `CRON_SECRET`, et tous les seconds facteurs deviendraient illisibles.
- **Back-office rendu en entier à la requête** (`instant = false` sur ses racines) et **redirections d’accès dans `proxy.ts`** (303, requêtes GET) : avec `<Suspense>`, le contenu arrive en flux dans un bloc masqué que seul JavaScript insère, et un `redirect()` décidé pendant le rendu ne passe que par JavaScript (mesuré : page « Chargement… » sans JavaScript). Le proxy n’est qu’un premier filtre ; pages et actions revérifient tout.
- **Nombre d’éléments des listes fixe dans l’éditeur** (FAQ, zones, étapes…) : ajout, retrait et ordre par glisser-déposer arrivent avec les listes en phase 6 (brief §7). Tous les textes et valeurs existants sont modifiables dès maintenant.
- **« À confirmer »** : une case par champ de premier niveau (ex. `prix.vivant`, `livraison.zones`), comme les 14 marques de départ.
- **Aperçu** réservé au propriétaire ; ses formulaires envoient de vraies demandes (c’est la même page que le site), d’où le bandeau.
- **Formulaires du back-office** : actions serveur ; pas de remise à zéro automatique après une erreur (la saisie reste) ; tout fonctionne aussi sans JavaScript (vérifié pour la connexion complète).
- **« Écrire sur WhatsApp »** passe par une action (note dans l’historique), puis redirige vers WhatsApp dans le même onglet (sur téléphone, l’application s’ouvre).
- **Mots de passe** : 12 caractères au moins (une phrase de plusieurs mots est conseillée), sans règle de composition imposée.
- **Dépendances ajoutées** (versions exactes) : `better-auth` 1.7.7 (exigée par la pile), `uqr` 0.1.3 (QR code SVG, pur JavaScript, sans dépendance ; servira aussi aux liens de campagne). `npm audit` signale 4 vulnérabilités « moderate » (à examiner en phase 7).

## Phase 5 — défaut de la phase 4 trouvé et corrigé

- **Page de confirmation sans JavaScript** (`/demande/confirmation`) : son résultat était rendu derrière `<Suspense>`, donc arrivé en flux dans un `<div hidden>` que seul JavaScript insère. **Un visiteur sans JavaScript voyait « Chargement… »** au lieu de sa référence et du bouton WhatsApp. Les tests de la phase 4 lisaient le texte du bloc masqué (`innerText`) et ne l’ont pas vu. Corrigé : rendu en entier à la requête, sous une racine à part `app/(confirmation)` (placé sous la racine du site, ce réglage empêchait la revalidation de la page d’accueil de prendre effet aussitôt : mesuré, 2 tests de publication en échec). Les tests vérifient maintenant que le message et le bouton sont **visibles** et qu’aucun « Chargement » ne reste.

## Phase 5 — écarts avec la maquette

Aucun sur la page publique : DOM, textes et console identiques au contrôle de la phase 4 (ci-dessous). Les fichiers de la page ont seulement changé de place (`app/(site)/`, `components/site/document.tsx`, `components/site/page.tsx`).

## Phase 5 — contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | 0 erreur |
| `npm test` | **142 tests** réussis (9 fichiers ; 20 nouveaux) : export CSV (BOM, séparateur, CRLF, 7 formules neutralisées, guillemets), masquage (numéros camerounais et étrangers, e-mails, seuls les champs sensibles), durées de verrouillage, résumé de l’appareil (Samsung Internet, Safari iOS, Facebook…), **éditeur : une feuille par valeur de la maquette, règles reprises du schéma** (obligatoire, longueur, bornes, dates, choix), chemins, différences, réponses lisibles |
| `npm run test:base` (`hpf_test`) | **17 tests** réussis (la purge lit maintenant la durée réglée) |
| `npm run test:e2e` (standalone sur `hpf_test`, Mailpit dédié), 2 passages complets | **41 tests** réussis à chaque passage, dont **9 nouveaux** pour le back-office : sans session → connexion (avec et sans JavaScript, export refusé) ; **première connexion avec activation du TOTP** (code calculé par le test depuis la clé affichée, RFC 6238), mauvais code refusé, **code de secours**, **connexion complète sans JavaScript** ; **5 mots de passe faux ⇒ verrouillé, même avec le bon** (et journalisé) ; demande : statut avec historique, note (absente du journal), **export CSV** (octets du BOM, en-têtes, formule neutralisée) ; contenus : valeur invalide refusée au champ, enregistrement au brouillon sans toucher la page, aperçu, **publication ⇒ page publique à jour**, **retour arrière ⇒ ancienne page** ; **numéro WhatsApp refusé sans code TOTP, accepté avec, masqué au journal** ; rôle Équipe refusé sur Contenus ; révocation des autres sessions (l’autre appareil est déconnecté) ; **axe-core : 0 violation sur 9 pages** du back-office |
| `npm run site:parite -- --sans-captures` (4 formats × 3 modes) | identique à la phase 4 : DOM 91 à 95 écarts, tous dans « Votre demande » (phase 4), 1 région de texte (confidentialité), **0 erreur console** |
| Sans JavaScript (curl) | `/admin/contenus` sans session → **303** vers `/admin/connexion` ; `/admin/connexion`, `/admin/invitation/…`, `/demande/confirmation` : contenu complet dans le HTML, aucun bloc masqué |
| Captures du back-office à 393 px (connexion, activation, tableau de bord, demandes, fiche, contenus, prix, publier) | relues à l’œil : lisibles, sans débordement ; deux retouches faites (nom du groupe au lieu de sa clé au tableau de bord, réponses lisibles dans la fiche) |
| Maquette | empreinte SHA-256 inchangée |

## Phase 5 — mesures (local)

Lighthouse 13.5, serveur standalone, page publique (`reference/mesures/site-phase5-local.json`) : mobile **91** (91, 92, 90), ordinateur 100 ; accessibilité et bonnes pratiques 100 ; SEO 66 (`noindex` volontaire) ; FCP 1,37 s, LCP 2,94–3,05 s, TBT 165–209 ms, CLS 0. **JavaScript client de la page publique** : 7 fichiers, 471 Ko décompressés, **120,9 Ko en brotli** (+0,6 Ko : découpage des modules partagés avec l’aperçu ; aucun code du back-office). Dans le bruit de mesure de la phase 4 (92, 92, 91).

## Phase 5 — reste à faire

- **Vous**, au déploiement : ajouter `AUTH_SECRET` aux variables, créer votre compte (`npm run admin:creer`, guide §6), activer le second facteur, changer le mot de passe provisoire, puis vérifier les 14 valeurs « à confirmer » (Contenus) et publier.
- Vérifier en ligne que les redirections de `/admin` pointent vers l’adresse publique (guide §6).
- Phase 6 : listes (ajout, retrait, ordre par glisser-déposer : FAQ, zones, avis avec accord écrit, photos, promoteur), campagnes, statistiques, **page du journal d’audit** et sa conservation de 24 mois.
- Phase 7 : `npm audit`, CSP complète (le back-office ne charge aucun script ni style externe).

## Phase 4 — fait (formulaires, demandes, e-mail, WhatsApp ; vérifié en local)

- **Trois formulaires** : à la dernière étape, « Numéro WhatsApp » (obligatoire), case obligatoire « J’accepte d’être contacté sur WhatsApp au sujet de ma demande. », case des annonces inchangée (facultative, décochée ; absente du formulaire Pro, comme dans la maquette), champ piège invisible. Normalisation du numéro (`lib/demandes/numero.ts`, la même au navigateur et au serveur) : espaces, points, tirets, parenthèses retirés ; `00` → `+` ; 9 chiffres commençant par 6 ou 2 → `+237` ; `+` suivi de 8 à 15 chiffres (diaspora).
- **Envoi** (`POST /api/demandes`) : tout revalidé par Zod (`lib/demandes/schema.ts`) ; référence `HP-AAMMJJ-XXXXXX` (date de Douala, 6 caractères sans 0/O/1/I) ; demande, historique (« création ») et e-mail au propriétaire enregistrés dans une même transaction ; e-mail envoyé juste après la réponse (`after()`), sinon retenté par la tâche « emails ». Vue de succès de la maquette, message de la maquette suivi de « (Réf. …) » ; « Ouvrir WhatsApp et envoyer » reste un lien : WhatsApp ne s’ouvre jamais tout seul.
- **Repli** : sans réseau, erreur ou délai de 20 s dépassé, le navigateur compose le message lui-même (sans référence), garde la saisie et affiche « Réessayer » ; la même clé d’envoi évite un doublon si la première tentative était arrivée.
- **Sans JavaScript** : les formulaires s’envoient (deux étapes à la suite, onglets en CSS `:has()`, sinon formulaires empilés) ; redirection vers `/demande/confirmation` (jeton signé 30 min, aucune donnée personnelle dans l’adresse, `noindex`, jamais en cache) avec le message et le bouton WhatsApp ; en cas d’erreur, la page dit quels champs corriger.
- **Anti-spam** sans service tiers : champ piège et délai minimal de 3 s (succès factice, rien d’enregistré) ; origine contrôlée ; limites en base de 10 envois par heure et par adresse, 3 demandes par jour et par numéro, sur des empreintes HMAC à sel quotidien (jamais l’adresse ni le numéro en clair).
- **Source de la visite** gardée avec la demande : `?src=`, `utm_*`, domaine d’origine (sans JS : lus dans l’adresse de la page).
- **Conservation** : tâche quotidienne `purge-demandes` (12 mois après la dernière mise à jour, réglable par `DEMANDES_CONSERVATION_MOIS`, historique et e-mails compris ; compteurs anti-spam de plus de 2 jours).
- **Confidentialité** : texte réécrit ([projet à valider](docs/confidentialite-projet.md)). Sur une installation existante, il est **publié automatiquement au démarrage** si le brouillon n’a pas d’autre modification en attente (sinon corrigé dans le brouillon seulement, avec un avertissement au journal). Nouveau contrôle bloquant : un texte « rien n’est enregistré » ne peut plus être publié.
- **Base** : migration `drizzle/0002_demandes.sql` (`demande`, `demande_evenement`, `limite_debit`, lien `email_sortant.demande_id` avec suppression en cascade).
- **Configuration** (`.env.example`) : `DEMANDES_SECRET` (vide : dérivé de `CRON_SECRET`, un déploiement sans la nouvelle variable continue de fonctionner), `IP_ENTETE`, `IP_PROXYS`, `DEMANDES_CONSERVATION_MOIS`.
- **Documents** : [architecture](docs/architecture.md) §6 et §8, [modèle de données](docs/modele-donnees.md) §3 et §5, [guide de déploiement](docs/deploiement-hostinger.md) §4 et §6, [risques](docs/risques-et-questions.md) R18, [confidentialité](docs/confidentialite-projet.md), CLAUDE.md.

## Phase 4 — décisions

- **Limite par adresse à 10 par heure** (l’architecture proposait 5) : plusieurs clients peuvent partager une adresse (réseau mobile, cybercafé). Un visiteur bloqué n’est jamais perdu : son message WhatsApp reste prêt.
- **Adresse du visiteur** : dernière adresse de `x-forwarded-for` (celle qu’ajoute le proxy) ; les précédentes peuvent être forgées. Vérifié dans le code de Next : il ne pose cet en-tête que s’il manque. À confirmer en ligne (R18) ; `IP_PROXYS=0` désactive la limite par adresse si l’en-tête n’est pas fiable.
- **Ajout prudent à la normalisation** : « 237 » suivi de 9 chiffres (indicatif tapé sans « + ») est lu comme `+237…` ; un numéro `+237` doit avoir 9 chiffres commençant par 6 ou 2.
- **Sans SMTP configuré**, la demande est enregistrée quand même (aucun e-mail mis en file) : on ne perd jamais une demande pour un réglage manquant.
- **Robot détecté** (piège, envoi trop rapide) : réponse de succès ordinaire, sans référence ; rien n’est enregistré.
- **Texte de confidentialité publié sans attendre votre validation** : l’ancien devenait faux dès le premier enregistrement ; le nouveau est vrai et prudent. À valider ou modifier.
- **Mesure maison** (vues, clics, entonnoir, `sendBeacon`) : prévue avec les statistiques en phase 6, comme dans le découpage du brief §7. Seule la source de la visite est déjà gardée avec chaque demande.
- **Tests de bout en bout** : chaque contexte de navigateur se présente avec une adresse distincte (`x-forwarded-for`, plage réservée aux essais) ; aucun contournement de la limite dans le code.

## Phase 4 — écarts avec la maquette (justifiés)

| Écart | Raison |
| --- | --- |
| Champs « Numéro WhatsApp » et accord, champ piège (invisible), `action="/api/demandes"` sur les formulaires | brief §3 |
| Bloc `<noscript>` « Le formulaire a besoin de JavaScript » retiré ; formulaires visibles et utilisables sans JavaScript | brief §3 (amélioration progressive), R7 |
| Phrase sous les formulaires et bloc « Confidentialité » réécrits | l’ancien texte (« rien n’est enregistré ») serait faux ; brief §3 |
| Message WhatsApp suivi de « (Réf. HP-…) » | brief §3 ; sans la référence, identique à la maquette (contrôle de parité) |
| Alerte « Votre demande n’a pas pu nous parvenir… » et bouton « Réessayer » dans la vue de succès (masqués sauf échec) | brief §3 |
| Sections au-dessus du formulaire : 3 pixels d’écart au plus sur les captures | la page fait 22 px de plus (nouveaux champs) : la barre de lecture de l’en-tête avance un peu moins vite |

## Phase 4 — contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | 0 erreur |
| `npm test` | **122 tests** réussis (8 fichiers ; 49 nouveaux) : normalisation (13 numéros acceptés, 12 refusés), référence (forme, alphabet, date de Douala à minuit, 200 tirages distincts), validation des 3 formulaires (15 cas refusés avec le bon champ), **message composé côté serveur identique à celui du navigateur**, « (Réf. …) », lien de confirmation (échéance, falsification, autre secret), empreintes (stables dans la journée, changent le lendemain, jamais la valeur), adresse derrière 0 à 5 proxys, origine, e-mail (contenu, HTML échappé, aucune ressource distante), confidentialité (contenu initial publiable, ancien texte bloqué puis remplacé) |
| `npm run test:base` (`hpf_test`) | **17 tests** réussis (9 nouveaux) : transaction demande + événement + e-mail, **clé d’envoi : pas de doublon, même avec deux envois simultanés**, limites (3 par numéro, 10 par adresse, aucune valeur en clair), purge à 13 mois avec historique et e-mails en cascade, mise à jour du texte de confidentialité (publiée une seule fois ; brouillon seulement s’il y a d’autres modifications) |
| `npm run test:e2e` (serveur standalone sur `hpf_test`, Mailpit dédié), 3 passages | **32 tests** réussis à chaque passage, dont 8 nouveaux : avec JS, demande en base avec sa source et **e-mail reçu** (« Nouvelle demande Poulets — HP-… ») ; **sans réseau** : message composé par le navigateur, saisie gardée, puis « Réessayer » enregistre ; **réponse perdue** : « Réessayer » retrouve la même demande, sans doublon ; piège : rien d’enregistré ; autre origine : 403 ; **sans JS** : Cérémonie, Poulets (onglet choisi en CSS, livraison) et Pro enregistrés, page de confirmation avec référence et bouton WhatsApp, numéro absent de l’adresse ; champs manquants nommés. Les 3 tests de formulaires existants vérifient en plus le numéro, l’accord et la référence. **axe-core : 0 violation** sur la page, la vue de repli et la page de confirmation |
| Essais manuels (curl, Node) | JSON → 201 et `no-store` ; formulaire classique → 303 ; origine étrangère → 403 ; e-mails partis juste après la réponse (statut « envoyé », 1 tentative) |
| `npm run site:parite` (4 formats × 3 modes) | écarts DOM **seulement dans la section « Votre demande »** (91 à 95 lignes : champs ajoutés, `<noscript>` retiré) ; textes : **seule la phrase de confidentialité** diffère ; **message de cérémonie identique à la maquette, référence à part** ; 0 erreur console. Captures : écarts dans la section du formulaire et en dessous (page plus haute), 3 pixels au plus au-dessus (barre de lecture) ; accueil épinglé à 66 et 97 % : anticrénelage déjà expliqué en phase 2 |
| Maquette | empreinte SHA-256 inchangée |

## Phase 4 — mesures (local)

Lighthouse 13.5, serveur standalone (`reference/mesures/site-phase4-local.json`) : mobile **92** (92, 92, 91), ordinateur 100 ; accessibilité et bonnes pratiques 100 ; SEO 66 (`noindex` volontaire) ; FCP 1,36 s, LCP 2,95–3,06 s, TBT 172–186 ms, CLS 0. **JavaScript client** : 6 fichiers, 471 Ko décompressés, **120,3 Ko en brotli** (+0,8 Ko : envoi, repli, normalisation du numéro). CSS : toujours 2 fichiers (`app/site.css` fusionné avec celui de la maquette).

## Phase 4 — reste à faire

- **Vous** : valider ou corriger le [texte de confidentialité](docs/confidentialite-projet.md) (§5 : durée, hébergement hors du Cameroun, responsable du traitement, livreur).
- Une fois en ligne : ajouter `DEMANDES_SECRET`, vérifier l’en-tête IP (guide §6, R18), envoyer une vraie demande et vérifier la réception de l’e-mail.
- Phase 5 : liste et fiche des demandes, statuts, notes, export CSV, suppression des données d’un client.

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

## Photos fournies (16/10/2026)

- Héros : photo des poulets dans l’enclos en fond (`public/photos/heros-800|1600.webp`, 46 et 113 Ko, légèrement floutée), sous un voile vert reprenant le dégradé de la maquette (`app/site.css`) ; image décorative (`alt=""`), `fetchPriority="high"`.
- La ferme : photo des poulets dans l’herbe en bandeau entre l’introduction et les engagements (`ferme-800|1600.webp`, 27 et 71 Ko), texte alternatif, chargement différé, 3:2 sur mobile et 21:9 sur ordinateur.
- Écart volontaire à la maquette (qui n’a pas de photo) et à la règle « pas de photo de banque d’images » : demandé par vous. À remplacer par des photos de la ferme dès que possible.
- Contrôles : `typecheck`, `build`, `npm test` (142/142), captures 390 et 1 440 px relues (texte lisible sur la photo).

- 16/10/2026, à votre demande : photos inversées (héros : poulets dans l’herbe, 23 et 58 Ko, non floutée ; La ferme : enclos en terre, 88 et 285 Ko) et voile du héros allégé (opacité 0,62 → 0,48 au lieu de 0,82 → 0,74). Captures 390 et 1 440 px relues : texte toujours lisible.

- 16/10/2026, à votre demande : photo de l’enclos aussi en fond de la section La ferme (`#la-ferme`, `app/site.css`), sous un voile blanc à 86–90 % ; captures 390 et 1 440 px relues, texte lisible.

- 16/10/2026, à votre demande : nom « Hope & Peace Farm » retiré de la barre de navigation (le lien garde le nom pour les lecteurs d’écran, `aria-label`) et du pied de page, devise « Nourrir l’avenir avec confiance » retirée du pied de page (le champ `pied.signature` reste en base, inutilisé). Typecheck, 142 tests, captures 390 et 1 440 px relues.

- 16/10/2026, à votre demande : bandeau des Fêtes transformé en notification flottante (en bas à gauche sur ordinateur, au-dessus de la barre fixe sur mobile), masquée au chargement, affichée après 4 s, bouton « Fermer l’annonce » ; fermée (ou lien suivi), elle ne revient plus de la session (`sessionStorage`). Sans JS, elle reste masquée (l’offre reste dans la section des Fêtes). Écart volontaire à la maquette (bandeau fixe en haut). Vérifié avec Playwright à 390 et 1 440 px : masquée au départ, visible à 4,5 s, masquée après fermeture et après rechargement ; 142 tests.

## Reste à faire

- Terminer la phase 1 en ligne (par vous) : voir « Phase 1 — reste à faire » ci-dessus.
- Phase 6 (listes, photos, campagnes, statistiques, journal) dès le « GO phase 6 ».

## Blocages

- **Déploiement** : fait par vous (réponse à la question 1).
- **Domaine** `hopeandpeacefarm.com` non enregistré (question 2) : sans lui, pas de boîte e-mail chez Hostinger, donc pas d’essai SMTP réel ni de SPF/DKIM.
- Question 3 (hébergement hors du Cameroun) : ne bloque pas le travail technique.
- Réseau du poste très lent (6 à 40 Ko/s, coupures) : levé pour la phase 1, toutes les dépendances sont en cache.
