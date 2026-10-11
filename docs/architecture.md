# Architecture proposée

État : proposition de la phase 0, à valider avant la phase 1. Les choix marqués **(à vérifier en phase 1)** dépendent de l’hébergement réel.

## 1. Vue d’ensemble

```text
Navigateur (Android 3G/4G, navigateur Facebook)
   │  HTML complet mis en cache · CSS · polices · ~1 fichier JS d’amélioration
   ▼
Hostinger Business — application Node.js (next start), déployée depuis GitHub
   ├─ /                      page publique (composants serveur, cache, revalidée à la publication)
   ├─ /demande/confirmation  confirmation sans JavaScript (noindex, jamais en cache)
   ├─ /go/{code}             liens de campagne → / ?src={code}
   ├─ /api/demandes          enregistrement d’une demande (JSON ou formulaire classique)
   ├─ /api/mesure            mesure maison (sendBeacon, groupée)
   ├─ /api/taches            tâches planifiées (jeton secret)
   ├─ /api/auth/*            Better Auth
   ├─ /medias/*              photos servies depuis UPLOAD_DIR
   └─ /admin/*               back-office (noindex, sessions, TOTP)
        │
        ├─ MySQL/MariaDB (Drizzle) : contenus, versions, demandes, comptes, mesure, journal
        ├─ UPLOAD_DIR (hors du dossier de déploiement) : photos WebP
        └─ SMTP de la boîte du domaine (Nodemailer) : notifications et alertes
```

Une seule application Next.js à la racine du dépôt, un seul processus Node. Pas de service tiers chargé par le navigateur ; côté serveur, seuls MySQL et le SMTP du domaine.

## 2. Pile et versions visées

| Élément | Choix | Remarque |
| --- | --- | --- |
| Node.js | 22 LTS (24 si disponible chez Hostinger) | versions proposées par Hostinger : 18, 20, 22, 24 |
| Next.js | 16.x (dernière stable : 16.4.0 au 11/10/2026) | App Router, `next start` |
| React | 19.x | composants serveur par défaut |
| TypeScript | strict, `noUncheckedIndexedAccess` | |
| Base | MySQL 8 ou MariaDB 10.6+ ; `mysql2` (pur JS) | utf8mb4, fuseau UTC en base |
| ORM | Drizzle ORM + drizzle-kit | migrations SQL versionnées dans `drizzle/` |
| Auth | Better Auth : e-mail + mot de passe, extension `twoFactor` (TOTP + codes de secours), sessions en base | hachage scrypt par défaut (pur JS, pas de module natif) |
| Validation | Zod 4 | schémas partagés client/serveur |
| E-mail | Nodemailer, SMTP de la boîte du domaine | file d’envoi en base |
| Images | sharp (seul module natif) | binaires précompilés linux-x64 **(à vérifier en phase 1)** |
| QR codes | génération SVG côté serveur (bibliothèque pure JS) | |
| Tests | Vitest (unitaires), Playwright (bout en bout, parité), axe-core | |

## 3. Arborescence

```text
app/
  (site)/layout.tsx            <html class="no-js" suppressHydrationWarning data-wa data-fetes-*>, script de tête, polices
  (site)/page.tsx              page publique (serveur)
  (site)/demande/confirmation/ page de confirmation sans JS
  go/[code]/route.ts           redirection de campagne + comptage
  api/demandes/route.ts        POST demande
  api/mesure/route.ts          POST événements groupés
  api/taches/route.ts          tâches planifiées
  api/auth/[...all]/route.ts   Better Auth
  medias/[...chemin]/route.ts  fichiers de UPLOAD_DIR (cache long, noms immuables)
  admin/                       back-office (voir §9)
  sitemap.ts · robots.ts
components/site/               un composant serveur par section (voir correspondance-sections.md)
components/site/client/        Menu, BarreFixe, Demande (formulaires), MoteurAnimations
components/admin/
lib/contenu/                   schéma Zod du contenu, valeurs initiales (= maquette), registre des champs, contrôles de publication
lib/whatsapp/                  normalisation des numéros, composition des messages, liens wa.me
lib/demandes/                  référence HP-AAMMJJ-XXXXXX, anti-spam, enregistrement
lib/moteur/                    moteur d’animations porté de la maquette (TS natif, sans React)
lib/mail/ lib/mesure/ lib/medias/ lib/securite/ lib/auth/ lib/db/
styles/maquette.css            CSS de la maquette, mêmes classes ; styles/admin.css
public/                        favicon, image Open Graph
drizzle/                       migrations ; scripts/ : extraction, captures, mesures, migration, données initiales
tests/unitaires/ · tests/e2e/
```

## 4. Page publique : rendu et cache

- **Composants serveur** pour toutes les sections ; le HTML est complet au premier octet, aucun contenu chargé après coup.
- **Source unique** : la *version publiée* du contenu (un instantané JSON validé par Zod, voir modele-donnees.md), lue une fois par rendu.
- **Cache** : la page est rendue statiquement et étiquetée `contenu-publie` (Cache Components de Next 16 : `"use cache"` + `cacheTag`). La Server Action « Publier » appelle `updateTag('contenu-publie')` (expiration immédiate, API de Next 16) : la requête suivante reçoit la nouvelle page, bien sous la minute. Un test de bout en bout le vérifiera.
- **En-tête `Cache-Control` du HTML** : `public, max-age=0, s-maxage=30, stale-while-revalidate=30`. Next peut poser par défaut un `s-maxage` très long sur les pages statiques ; si un cache ou un CDN Hostinger est devant l’application, la publication ne se verrait pas avant longtemps. **(à vérifier en phase 1 : présence d’un cache intermédiaire et respect de l’en-tête.)**
- **Fêtes** : comme dans la maquette, le script de tête pose `fetes-garanti` / `fetes-fin` selon la date de Douala, avant le premier rendu. En plus, le serveur pose déjà ces classes au rendu, et une tâche planifiée revalide la page à minuit (heure de Douala) aux dates de bascule : sans JavaScript aussi, le bandeau disparaît à la bonne date. Écart volontaire avec la maquette sans JS (qui n’affiche jamais la phrase de garantie), à justifier dans la recette.
- **Polices** : `next/font/local` avec les trois WOFF2 extraits ; les polices de repli ajustées de la maquette (`Display Fallback`, `Text Fallback`) sont reprises telles quelles (pas de `adjustFontFallback` automatique, pour garder les mêmes métriques).
- **Sprite SVG** (logo en 13 calques, 24 icônes) rendu une fois en tête de `<body>`, comme dans la maquette.
- **Performance** : la maquette fait 87 sur Lighthouse mobile ; le temps de blocage vient du style et de la mise en page, pas du script (diagnostic dans `reference/mesures/diagnostic.json`, `npm run maquette:diagnostic`). Pistes sans effet visuel à reprendre au portage : `content-visibility: auto` sur les sections hors écran, et arbitrage sur la recherche `local()` des polices de repli (gain de blocage contre risque de décalage).

## 5. Moteur d’animations

- `lib/moteur/` reprend les sections 2 à 10 de `principal.js` (menu, section courante, barre fixe, détails depuis l’ancre, landing épinglée, en-tête et barre de lecture, apparitions), découpées en modules TypeScript sans dépendance.
- Un composant client `MoteurAnimations` (rendu `null`) l’appelle une seule fois dans `useEffect` ; une garde empêche le double lancement (mode strict, navigation). Aucune donnée de défilement ne passe par l’état React : le moteur pose des variables CSS et des classes, comme la maquette.
- Le script de tête est repris à l’identique (classes `js`, `motion`, `scrolly`, Fêtes) en `<script>` en ligne dans `<head>`, avant tout CSS bloquant.
- Différence de minutage à surveiller : dans la maquette, le script s’exécute en fin de `<body>` ; avec Next, il s’exécute après l’hydratation. La règle « ce qui est déjà visible au chargement n’est jamais masqué » de la maquette évite tout clignotement ; les captures de parité le vérifieront.

## 6. Formulaires et demandes

Composant client `Demande` : onglets, deux étapes, validation, brouillon en `sessionStorage`, compteur, vue de succès, copie du message — portés de la section 6 de `principal.js`, avec les mêmes libellés.

**Ajouts** à la dernière étape des trois formulaires : « Numéro WhatsApp » (obligatoire), case obligatoire « J’accepte d’être contacté sur WhatsApp au sujet de ma demande. », champ piège invisible. La case des annonces reste facultative et décochée.

### Flux avec JavaScript

1. Validation locale (règles de la maquette + numéro), puis `POST /api/demandes` en JSON.
2. Le serveur revalide tout (Zod), applique l’anti-spam, normalise le numéro, crée la référence `HP-AAMMJJ-XXXXXX` (date de Douala, 6 caractères tirés de `crypto.randomInt` sur un alphabet sans 0/O/1/I), enregistre la demande et l’e-mail à envoyer dans une même transaction, puis répond `{ reference, message, lien }`.
3. La vue de succès de la maquette s’affiche ; le message est celui de la maquette suivi de « (Réf. HP-…) ». « Ouvrir WhatsApp et envoyer » est un lien : WhatsApp ne s’ouvre jamais tout seul.
4. L’e-mail au propriétaire part juste après la réponse (`after()`), sans ralentir le visiteur.

**Sans réseau ou erreur serveur** : le navigateur compose lui-même le message (même module `lib/whatsapp`, sans référence), affiche la vue de succès avec un avertissement et un bouton « Réessayer » ; la saisie reste en `sessionStorage`.

**Sans JavaScript** : les formulaires sont de vrais `<form method="post" action="/api/demandes">`. Sans la classe `js`, les deux étapes s’affichent l’une sous l’autre et les onglets basculent en CSS (`:has()`, avec repli : les trois formulaires empilés). Le serveur répond par une redirection 303 vers `/demande/confirmation?d={jeton signé, 30 min}` qui affiche le message et le bouton WhatsApp. Aucune donnée personnelle dans l’URL. C’est un écart voulu avec la maquette (qui affiche « Le formulaire a besoin de JavaScript »).

### Anti-spam sans service tiers

- champ piège (rempli ⇒ réponse de succès factice, rien n’est enregistré) ;
- délai minimal entre l’ouverture du formulaire et l’envoi (3 s, mesuré par le script ; non applicable sans JS, la page étant en cache) ;
- limites de débit en base : par empreinte d’IP (HMAC-SHA-256 avec un sel qui tourne chaque jour, jamais l’IP en clair) et par numéro normalisé (empreinte aussi), par exemple 5 demandes/heure/IP et 3/jour/numéro ;
- contrôle de l’origine : `Origin` (ou `Sec-Fetch-Site`) doit être le domaine du site.
- **(à vérifier en phase 1 : quel en-tête porte l’IP réelle du visiteur derrière le proxy Hostinger.)**

## 7. E-mails

- Table `email_sortant` (file d’envoi) : chaque notification est d’abord écrite en base, puis envoyée par Nodemailer. Échec ⇒ nouvelles tentatives espacées (5 au plus), puis statut « échec » visible au tableau de bord.
- Messages : nouvelle demande (au propriétaire), alerte de sécurité (changement de numéro WhatsApp, d’e-mail de notification ou de paiement, nouvelle connexion), invitation d’un membre de l’équipe.
- Contenu des e-mails : texte brut + HTML simple, sans image distante.

## 8. Tâches planifiées

Un seul point d’entrée `POST /api/taches` protégé par un jeton (`CRON_SECRET`), qui exécute les tâches dues, chacune idempotente et protégée par un verrou MySQL (`GET_LOCK`) :
nouvelles tentatives d’e-mails · purge des demandes au-delà de la durée de conservation (12 mois par défaut) · purge des limites de débit et des sessions expirées · agrégation quotidienne des statistiques · revalidation aux bascules des Fêtes.

Déclencheurs, du plus fiable au plus simple :

1. tâche cron hPanel (`curl` vers l’URL) si elle est disponible pour l’application Node.js, ou depuis un autre site PHP du même compte ;
2. sinon, minuteur interne lancé depuis `instrumentation.ts` (toutes les 15 min) : un développeur signale en septembre 2026 que les applications Node.js de Hostinger n’ont pas accès aux tâches cron de hPanel. **(à vérifier en phase 1.)**

## 9. Back-office (`/admin`)

- Interface mobile d’abord, composants serveur + Server Actions (protection d’origine intégrée de Next), très peu de JavaScript client. CSS propre au back-office, mêmes couleurs et polices que le site.
- **Connexion** : e-mail + mot de passe (scrypt), puis TOTP obligatoire. Premier passage : inscription forcée du TOTP et affichage des 10 codes de secours. Pas d’inscription publique : le premier compte Propriétaire est créé par `npm run admin:creer`, les suivants par invitation.
- **Verrouillage** : 5 échecs (mot de passe ou TOTP) ⇒ compte verrouillé 15 min puis déverrouillage progressif ; limites de débit par IP en plus (Better Auth). Compteurs dans la table `utilisateur`.
- **Rôles** : Propriétaire (tout) et Équipe (demandes seulement), vérifiés côté serveur dans chaque action et chaque page (pas seulement dans le menu).
- **Sessions** : en base, liste des sessions actives (appareil, date, empreinte d’IP) et révocation.
- **Ressaisie TOTP** pour le numéro WhatsApp, l’e-mail de notification et les numéros de paiement : la Server Action exige un code TOTP valide, envoie un e-mail d’alerte et écrit au journal.
- **Écrans** : tableau de bord · demandes (liste filtrable, fiche, statuts et historique, note, « Écrire sur WhatsApp », export CSV, suppression à la demande du client) · contenus (par groupe, avec aide, validation et badge « à confirmer ») · listes (FAQ, zones, avis, photos, promoteur) · publier (aperçu, contrôles, historique, retour arrière) · campagnes · statistiques · journal · sécurité (compte, sessions, codes de secours, équipe).
- **Réordonner** (photos, FAQ, zones) : glisser-déposer au doigt et à la souris, plus des boutons « Monter / Descendre » (WCAG 2.2, critère 2.5.7 : une alternative au glissement est obligatoire).

## 10. Contenus, brouillon et publication

- Le contenu complet de la page est **un document JSON typé** (schéma Zod `ContenuPage`) : valeurs (coordonnées, prix, délais, conditions, dates des Fêtes…), textes des sections et listes (FAQ, zones, avis, photos, promoteur).
- **Brouillon** : une ligne unique, modifiée champ par champ depuis le back-office (chaque enregistrement est validé et journalisé).
- **Publier** : contrôles (schéma valide, champs obligatoires, aucun `[…]` restant, aucune photo sans texte alternatif, aucun avis sans accord écrit), puis copie immuable du brouillon dans `version_contenu`, désignation comme version en ligne et revalidation de la page.
- **Retour arrière** : republier une ancienne version (nouvelle version « restaurée depuis la n° X »), avec la même revalidation.
- **Aperçu** : `/admin/apercu` rend la page publique avec le brouillon (mêmes composants), sans cache, en `noindex`.
- **Valeurs dans les textes** : un texte peut citer une valeur avec un repère, par exemple `Devis écrit sous {delais.devis}`. Changer le délai une fois met à jour toutes les phrases ; un repère inconnu bloque la publication. L’éditeur affiche le rendu final sous chaque champ.
- **Badge « à confirmer »** : stocké avec le brouillon, par champ ; affiché dans le back-office et compté au tableau de bord, jamais sur le site.
- Les libellés des formulaires, les messages d’erreur, les messages WhatsApp pré-remplis et les ancres restent dans le code (mesure, tests et comportements en dépendent).

## 11. Photos

- Réduction dans le navigateur avant envoi (≤ 2 000 px, JPEG/WebP qualité 0,85) : moins de données mobiles.
- Serveur : taille limitée (8 Mo à l’arrivée, 40 Mpx), type vérifié par les octets (JPEG, PNG, WebP, HEIC si sharp le gère), **ré-encodage systématique** par sharp en WebP (400, 800, 1 200, 1 600 px), métadonnées supprimées (dont la position GPS), noms de fichiers aléatoires et immuables dans `UPLOAD_DIR`.
- Texte alternatif obligatoire ; légende facultative ; ordre par glisser-déposer.
- Une photo utilisée par la version en ligne ou par une version de l’historique ne peut pas être supprimée physiquement (elle est masquée et purgée quand plus aucune version ne la cite).

## 12. Mesure maison

- Événements : `vue`, `clic` (valeur de `data-cta`), `formulaire` (onglet, étape atteinte, erreur, envoi réussi, WhatsApp ouvert, copie), avec la source de la visite : `?src=`, `utm_source/medium/campaign`, domaine d’origine (jamais l’URL complète).
- Envoi groupé par `navigator.sendBeacon` (à la fermeture ou au masquage de la page, et toutes les 10 s), `text/plain` pour éviter toute requête préalable.
- Aucun cookie, aucune IP, aucun identifiant persistant : un identifiant de visite aléatoire en `sessionStorage` (effacé à la fermeture de l’onglet) relie les étapes de l’entonnoir. Robots écartés par une liste d’agents connus (l’agent n’est pas stocké).
- Événements bruts gardés 90 jours, agrégats quotidiens conservés.

## 13. Sécurité

- En-têtes sur toutes les réponses : `Content-Security-Policy`, `Strict-Transport-Security` (2 ans, `includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (tout fermé), `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy: same-origin`.
- **CSP et page en cache** : une CSP à nonce oblige à rendre chaque page à la volée, ce qui casse le cache. Proposition : `script-src 'self'` + empreintes SHA-256 des scripts en ligne connus (script de tête), et vérification en phase 7 du traitement des scripts en ligne que Next ajoute pour l’hydratation ; s’ils ne peuvent pas être couverts par empreinte, je documenterai le compromis retenu et sa raison. Pas de `style=""` dans le HTML rendu (le moteur passe par le CSSOM, non soumis à la CSP).
- CSRF : Server Actions (contrôle d’origine intégré) et contrôle d’origine explicite sur les routes `/api/*` qui modifient des données ; Better Auth vérifie aussi l’origine.
- Requêtes paramétrées partout (Drizzle) ; aucune concaténation SQL.
- Journaux applicatifs : référence de demande et identifiants internes seulement, jamais nom, numéro, lieu ni IP.

## 14. Données personnelles (loi n° 2024/017)

- Données enregistrées par demande : type, réponses du formulaire, nom, numéro WhatsApp, consentement (date, texte exact accepté, version), choix « annonces », source de la visite, statut et notes internes. Pas d’IP, pas d’agent du navigateur.
- Conservation réglable (12 mois par défaut, après la dernière mise à jour), purge automatique quotidienne ; journal d’audit sans valeurs personnelles en clair.
- Droits : accès, correction (fiche de la demande) et suppression (« Supprimer les données de ce client », par numéro, avec confirmation ; la suppression est journalisée sans la donnée supprimée).
- Texte de confidentialité réécrit, à valider (projet dans `docs/confidentialite-projet.md` en phase 4).

## 15. Qualité et tests

- Unitaires (Vitest) : normalisation des numéros, composition des messages (comparés à la maquette, cas par cas), référence, export CSV, contrôles de publication, repères `{…}`.
- Bout en bout (Playwright) : trois formulaires avec et sans JS, hors ligne, connexion avec TOTP, publication qui met la page à jour, retour arrière.
- Parité : la maquette et le site sont capturés dans la même exécution (même navigateur) et comparés image par image ; seuil d’écart et liste des écarts justifiés tenus dans PROGRESS.md.
- Lighthouse et axe-core automatisés ; PageSpeed Insights une fois en ligne.

## 16. Hypothèses Hostinger à vérifier en phase 1

| Hypothèse | Ce que j’ai trouvé | Plan B |
| --- | --- | --- |
| Application Node.js sur l’offre Business, depuis GitHub | Confirmé par la documentation Hostinger (Business et Cloud ; Node 18, 20, 22, 24 ; jusqu’à 5 applications) | — |
| Dossier persistant pour les téléversements | Non documenté. Hostinger indique seulement que les dossiers de build et `public_html` sont gérés par le déploiement | photos stockées en base (table de binaires), servies avec cache long |
| Tâches cron | Signalé indisponible pour les applications Node.js (retour d’un développeur, sept. 2026) | cron depuis un autre site du compte, ou minuteur interne (§8) |
| `NODE_ENV` | Le même développeur signale que la plateforme impose `NODE_ENV=development` | forcer `NODE_ENV=production` dans les variables et le script de démarrage |
| Module natif sharp | Non documenté | à tester au premier déploiement ; sinon génération des variantes dans le navigateur |
| Cache ou CDN devant l’application | Non documenté | en-têtes `Cache-Control` explicites, purge à la publication si besoin |
| IP réelle du visiteur | Non documenté | lire l’en-tête du proxy identifié au test |
| MySQL distant ou local, version | Base MySQL incluse ; version à relever | — |
