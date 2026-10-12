# Architecture proposée

État : proposition de la phase 0, mise à jour aux phases 1 (hébergement, §16) et 2 (page publique : §3 à §6). Les choix marqués **(à vérifier en phase 1)** dépendent de l’hébergement réel.

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
   ├─ /api/sante             état de l’application ; rapport de l’hébergement avec jeton
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
  layout.tsx                   <html class="no-js" suppressHydrationWarning data-wa data-fetes-*>, script de tête, polices
  page.tsx                     page publique (serveur) ; maquette.css (généré depuis la maquette, ne pas modifier)
  demande/confirmation/        page de confirmation sans JS (phase 4)
  go/[code]/route.ts           redirection de campagne + comptage
  api/demandes/route.ts        POST demande
  api/mesure/route.ts          POST événements groupés
  api/taches/route.ts          tâches planifiées
  api/sante/                   diagnostic (état, rapport de l’hébergement, e-mail de test)
  api/auth/[...all]/route.ts   Better Auth
  medias/[...chemin]/route.ts  fichiers de UPLOAD_DIR (cache long, noms immuables)
  admin/                       back-office (voir §9)
  sitemap.ts · robots.ts
components/site/               composants serveur des sections (cadre, accueil, ceremonies, offres, ferme, demande),
                               rendu des textes riches (riche.tsx), icônes
components/site/client/        Comportements : seul composant client, lance le moteur (lib/moteur)
components/admin/
lib/contenu/                   schéma Zod et types, contenu initial (= maquette), repères {…} et mise en forme,
                               contrôles de publication, dépôt (brouillon, versions, retour arrière), lecture en cache ;
                               phase 5 : registre des champs (aides, badges) pour le back-office
lib/whatsapp/                  messages pré-remplis et composition (partagés serveur / navigateur) ; phase 4 : numéros
lib/site/                      script de tête, sprite SVG (généré depuis la maquette)
lib/demandes/                  référence HP-AAMMJJ-XXXXXX, anti-spam, enregistrement
lib/moteur/                    moteur porté de principal.js (TS natif, sans React) : menu, barre fixe, formulaires, landing, apparitions
lib/mail/ lib/mesure/ lib/medias/ lib/securite/ lib/auth/ lib/db/
public/                        favicon, image Open Graph
drizzle/                       migrations ; scripts/ : extraction, captures, mesures, migration, données initiales
tests/unitaires/ (npm test) · tests/e2e/ (npm run test:e2e, Playwright piloté par Vitest)
```

## 4. Page publique : rendu et cache

- **Composants serveur** pour toutes les sections ; le HTML est complet au premier octet, aucun contenu chargé après coup.
- **Source unique** : la *version publiée* du contenu (un instantané JSON validé par Zod, voir modele-donnees.md), lue une fois par rendu.
- **Cache** (phase 3) : la page est pré-rendue (statique) et le contenu publié, lu en base par `contenuPublie()` (`lib/contenu/lecture.ts`), est mis en cache (`"use cache"`), étiqueté `contenu-publie` et soumis au profil `PROFIL_CONTENU` (`lib/contenu/profil.ts`) : régénération en arrière-plan au plus toutes les 30 s, jamais servi au-delà de 5 min. La publication appelle `revaliderContenu()` (`lib/contenu/revalidation.ts` ; action serveur du back-office en phase 5, ou `POST /api/contenu/revalider` avec le jeton `CRON_SECRET` pour la ligne de commande) : `revalidateTag` + `revalidatePath("/")` tout de suite, puis de nouveau 2 s plus tard, avant de répondre ; la requête suivante reçoit la nouvelle page (5 passages sur 5 du test de bout en bout). Raisons, mesurées sur Next 16.4 : `revalidateTag(…, { expire: 0 })` seul laissait servir une fois l’ancienne page (« STALE ») ; et Next écrit l’entrée de cache d’une page après avoir répondu, si bien qu’une régénération commencée juste avant la publication pouvait écrire l’ancien contenu après la revalidation et paraître plus récente qu’elle. Le profil couvre ce que l’étiquette ne couvre pas : Next garde l’état des étiquettes **en mémoire** (documentation « How revalidation works »), perdu quand Hostinger arrête le processus faute de trafic ; la page suit alors la base en 30 s (mesuré : 33 s sans revalidation ; après redémarrage, 1 requête servie périmée puis la nouvelle). `expire` reste à 5 min, car en dessous Next exclut la page du pré-rendu.
- **Repli** si la base est indisponible (compilation chez l’hébergeur, panne) : dernier contenu publié gardé sur disque (`UPLOAD_DIR/.contenu/publie.json`, `lib/contenu/instantane.ts`), sinon contenu de la maquette ; tout contenu relu est revalidé par Zod avant le rendu.
- **En-tête `Cache-Control` du HTML** : posé par Next d’après le profil, `s-maxage=30, stale-while-revalidate=270` (vérifié en phase 3 ; il était d’un an avant, R16). Un cache intermédiaire chez Hostinger reste à vérifier en ligne.
- **Fêtes** : comme dans la maquette, le script de tête pose `fetes-garanti` / `fetes-fin` selon la date de Douala, avant le premier rendu. En plus (phase 3), le serveur pose ces classes au rendu (`lib/contenu/fetes.ts`, même règle, testée contre le script de tête lui-même) ; la page étant régénérée au plus toutes les 30 s, la bascule de minuit se voit dans la minute, sans tâche dédiée. Écart volontaire avec la maquette sans JS (qui n’affiche jamais la phrase de garantie).
- **Polices** : `next/font/local` avec les trois WOFF2 extraits ; les polices de repli ajustées de la maquette (`Display Fallback`, `Text Fallback`) sont reprises telles quelles (pas de `adjustFontFallback` automatique, pour garder les mêmes métriques).
- **Sprite SVG** (logo en 13 calques, 24 icônes) rendu une fois en tête de `<body>`, comme dans la maquette.
- **Performance** : la maquette fait 87 sur Lighthouse mobile ; le temps de blocage vient du style et de la mise en page, pas du script (diagnostic dans `reference/mesures/diagnostic.json`, `npm run maquette:diagnostic`). Pistes sans effet visuel à reprendre au portage : `content-visibility: auto` sur les sections hors écran, et arbitrage sur la recherche `local()` des polices de repli (gain de blocage contre risque de décalage).

## 5. Moteur d’animations

- `lib/moteur/` reprend les sections 2 à 10 de `principal.js` (menu, section courante, barre fixe, détails depuis l’ancre, landing épinglée, en-tête et barre de lecture, apparitions), découpées en modules TypeScript sans dépendance.
- **Deux temps** (phase 2, après mesure) :
  1. *partie immédiate* (`lib/moteur/immediat.ts` : Fêtes, menu, section courante, barre fixe, détails, landing, en-tête, apparitions), compilée par `npm run moteur:construire` en un script en ligne (`lib/site/moteur-immediat.ts`, 13 Ko bruts, 4,6 Ko en brotli), placé en fin de `<body>` comme celui de la maquette et lancé juste après la première image ; elle ne touche qu’aux classes, attributs, propriétés et variables CSS, ce que React 19 ne compare pas à l’hydratation en production ;
  2. *formulaires* (`lib/moteur/demande.ts`), lancés après l’hydratation par le composant client `Comportements` (rendu `null`, garde contre le double lancement), car ils écrivent des textes et des listes que l’hydratation exige identiques au HTML.
- Pourquoi : lancé après l’hydratation, tout le moteur démarrait 1,2 s (4G lente) à 1,8 s (3G) après le premier affichage, contre ~0,7 s pour la maquette (`npm run site:demarrage`, processeur ralenti ×4) ; la landing restait figée si l’on faisait défiler tôt. En ligne, il démarre 0,14 à 0,28 s après le premier affichage, sans le retarder. En développement, la partie immédiate démarre aussi après l’hydratation (sinon React signale les attributs posés avant elle).
- Aucune donnée de défilement ne passe par l’état React : le moteur pose des variables CSS et des classes, comme la maquette.
- **Phase 2 — choix retenu** : tout le comportement de la page (menu, section courante, barre fixe, détails, formulaires, landing, en-tête, apparitions) est dans ce moteur, et non dans des composants React clients. Raisons : fidélité (c’est le code de la maquette, typé, sans réécriture), poids (aucun balisage de formulaire dans le JavaScript envoyé, pas d’hydratation de composants), et formulaires préparés seulement à l’approche, comme la maquette. Le balisage des formulaires est rendu côté serveur, identique à la maquette. React reste maître du DOM : le moteur ne crée ni ne retire d’éléments rendus par React, il ne change que classes, attributs, textes vides prévus pour lui et variables CSS ; la page n’étant jamais re-rendue côté navigateur, rien ne les écrase.
- Retour arrière après un lien d’ancre : le routeur de Next ignore les entrées d’historique sans état (`handlePopState`), la page n’est ni rechargée ni re-rendue (test de bout en bout).
- Le script de tête est repris à l’identique (classes `js`, `motion`, `scrolly`, Fêtes) en `<script>` en ligne dans `<head>`, avant tout CSS bloquant.
- Minutage : la partie immédiate s’exécute en fin de `<body>` comme le script de la maquette (voir « Deux temps ») ; la règle « ce qui est déjà visible au démarrage n’est jamais masqué » évite tout clignotement ; captures de parité à l’appui.

## 6. Formulaires et demandes

Formulaires rendus côté serveur (`components/site/demande.tsx`), comportements dans `lib/moteur/demande.ts` : onglets, deux étapes, validation, brouillon en `sessionStorage`, compteur, vue de succès, copie du message — portés de la section 6 de `principal.js`, avec les mêmes libellés (phase 2). Les messages sont composés par `lib/whatsapp/messages.ts`, testé contre les fonctions de la maquette.

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
nouvelles tentatives d’e-mails · purge des demandes au-delà de la durée de conservation (12 mois par défaut) · purge des limites de débit et des sessions expirées · agrégation quotidienne des statistiques. (Plus de revalidation aux bascules des Fêtes : le profil de cache du contenu suffit, voir §4.)

Déclencheurs, du plus fiable au plus simple :

1. tâche cron hPanel (`curl` vers l’URL) si elle est disponible pour l’application Node.js, ou depuis un autre site du même compte ;
2. en dernier recours, minuteur interne lancé depuis `instrumentation.ts` (`TACHES_MINUTEUR_MINUTES`, désactivé par défaut). La documentation Hostinger indique que le processus est **arrêté après une période sans trafic** : le minuteur ne tourne donc que pendant les visites et ne remplace pas un cron. **(à vérifier sur le serveur : `docs/deploiement-hostinger.md` §7.)**

Phase 1 : tâches `emails` (file d’envoi, à chaque passage) et `purge-technique` (une fois par jour : exécutions de tâches > 30 jours, démarrages > 90 jours, e-mails de test > 30 jours). Chaque exécution est inscrite dans `tache_execution` avec son déclencheur (`cron`, `minuteur`, `manuel`).

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
- **Brouillon** : une ligne unique, modifiée champ par champ depuis le back-office (chaque enregistrement est validé et journalisé). Enregistrement du document complet, validé par le schéma, sous verrou optimiste (`revision`).
- **Publier** : contrôles (schéma valide, champs obligatoires, aucun `[…]` restant, aucune photo sans texte alternatif, aucun avis sans accord écrit), puis copie immuable du brouillon dans `version_contenu`, désignation comme version en ligne et revalidation de la page.
- **Retour arrière** : republier une ancienne version (nouvelle version « restaurée depuis la n° X »), avec la même revalidation. Le brouillon est remis à la version restaurée (sinon la publication suivante ramènerait l’erreur corrigée) ; l’opération signale s’il contenait des modifications non publiées. Publier un brouillon identique à la version en ligne ne crée pas de version.
- **Code (phase 3)** : `lib/contenu/schema.ts` (Zod, types déduits), `controles.ts`, `empreinte.ts`, `depot.ts` (verrou MySQL `hpf_contenu` + transaction), `lecture.ts`, `instantane.ts` ; ligne de commande `npm run contenu` en attendant le back-office ; contenu de la maquette publié automatiquement au premier démarrage (`initialiserSiVide`).
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

- En-têtes sur toutes les réponses : `Content-Security-Policy`, `Strict-Transport-Security` (2 ans, `includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (tout fermé), `frame-ancestors 'none'`. *Phase 2* : `Cross-Origin-Opener-Policy: same-origin` retiré, car il empêche Lighthouse de mesurer la page (trace sans début de navigation, `NO_NAVSTART`) ; à réessayer en phase 7 avec PageSpeed Insights.
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

## 16. Hypothèses Hostinger vérifiées en phase 1

Documentation Hostinger relue le 11/10/2026 (détail et sources : [deploiement-hostinger.md](deploiement-hostinger.md)). Chaque point non documenté est contrôlé sur le serveur par `GET /api/sante` (rapport protégé par jeton) et `scripts/verifier-deploiement.mjs`.

| Hypothèse | Ce que dit la documentation | Contrôle en ligne | Plan B |
| --- | --- | --- | --- |
| Application Node.js sur l’offre Business, depuis GitHub | Confirmé (Business et Cloud ; Node 18, 20, 22, 24) | page d’accueil, version de Node | — |
| Démarrage de Next.js | Mode serveur ; Hostinger **impose `output: "standalone"`** et lance le serveur lui-même ; configuration en objet obligatoire | compilation réussie | — |
| Dossier persistant pour les téléversements | Chaque déploiement crée `hbuilds/versions/<id>` et supprime les précédentes ; `hbuilds/` et `public_html/` réécrits. Rien sur un dossier hors de ces deux-là | marqueur dans `UPLOAD_DIR` relu après un 2ᵉ déploiement | photos stockées en base, servies avec cache long |
| Tâches cron | Non documenté pour les applications Node.js ; processus **arrêté sans trafic** | dernier passage `cron` dans `tache_execution` | cron depuis un autre site du compte ; minuteur interne en dernier recours (§8) |
| `NODE_ENV` | Non documenté (un développeur signale `development`) ; le serveur standalone de Next force `production` | valeur relevée à l’exécution | variable `NODE_ENV=production` |
| Module natif sharp | Non documenté (« l’optimisation d’images fonctionne ») | encodage WebP réel, image servie depuis `UPLOAD_DIR` | variantes générées dans le navigateur |
| Cache ou CDN devant l’application | Non documenté ; ISR et revalidation « fonctionnent » | en-têtes `age`, `x-*-cache`, `via` ; revalidation à la demande visible en moins d’une minute | en-têtes `Cache-Control` explicites, purge à la publication |
| IP réelle du visiteur | Non documenté (requêtes routées par un `.htaccess`) | en-têtes `x-forwarded-for`, `x-real-ip`, `forwarded`… (adresses tronquées) | lire l’en-tête identifié |
| MySQL ou MariaDB, version | Base incluse | version, fuseau, jeu de caractères, écriture | — |
| Durées de compilation | 15 min pour l’installation, 15 min pour la compilation | journal de compilation | — |
