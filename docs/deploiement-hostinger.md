# Déploiement sur Hostinger (phase 1)

Ce guide met en ligne le squelette et vérifie chaque hypothèse de l’[architecture §16](architecture.md#16-hypothèses-hostinger-vérifiées-en-phase-1). Il peut être suivi par le propriétaire du compte : aucune étape ne demande de transmettre un mot de passe.

Sources : documentation Hostinger consultée le 11/10/2026 ([création d’une application](https://docs.hostinger.com/node.js/creating-an-app), [réglages de compilation](https://docs.hostinger.com/node.js/build-settings), [Next.js](https://docs.hostinger.com/node.js/overview-1/next), [arborescence](https://docs.hostinger.com/node.js/file-structure), [vue d’ensemble](https://docs.hostinger.com/node.js/overview)).

## Ce que dit la documentation Hostinger (et ce que le code en tire)

| Fait documenté | Conséquence dans le code |
| --- | --- |
| Next.js tourne en mode serveur ; Hostinger **impose `output: "standalone"`** et lance lui-même le serveur (pas de commande de démarrage). | `next.config.mjs` est un objet (une fonction ferait échouer la compilation) et pose déjà `output: "standalone"`. Les migrations s’appliquent au démarrage via `instrumentation.ts`, faute de commande « avant démarrage ». |
| L’application vit dans `~/domains/<domaine>/hbuilds/current/nodejs` ; chaque déploiement crée une nouvelle version et **supprime les précédentes**. `hbuilds/` et `public_html/` sont réécrits à chaque déploiement. | `UPLOAD_DIR` doit être un chemin absolu **hors** de `hbuilds/` et de `public_html/` ; le diagnostic le refuse sinon. |
| Les variables d’environnement servent à la compilation **et** à l’exécution, et restent d’un déploiement à l’autre. | Toute la configuration passe par elles (modèle : `.env.example`). |
| Le processus est **arrêté après une période sans trafic** et relancé à la requête suivante. | Le minuteur interne ne peut pas remplacer un cron : il faut un vrai cron qui appelle `/api/taches`. Le diagnostic liste les démarrages pour observer ces mises en veille. |
| Installation des dépendances et compilation : 15 minutes chacune au plus. Journaux des 10 dernières compilations. | À surveiller au premier déploiement. |
| Node.js 18, 20, 22 (par défaut) et 24. | Choisir **24** (version de développement) ; 22 en repli. |

Points **non documentés**, vérifiés par le diagnostic : persistance réelle d’un dossier hors `hbuilds/`, cron pour une application Node.js, `NODE_ENV` à l’exécution, module natif sharp, cache ou CDN devant l’application, en-tête portant l’IP du visiteur, version de MySQL/MariaDB.

## 0. Avant de commencer

- Offre Hostinger **Business** (ou Cloud), avec accès à hPanel.
- Un **domaine** relié au compte. Sans domaine, Hostinger fournit une adresse temporaire, mais **pas de boîte e-mail** : l’étape 3 attendra le domaine (`hopeandpeacefarm.com` n’est pas enregistré au 11/10/2026).
- Un compte GitHub.

## 1. Dépôt GitHub privé

1. Sur GitHub : **New repository**, nom `hope-and-peace-farm`, **Private**, sans README ni licence.
2. Depuis le dossier du projet :

   ```sh
   git remote add origin https://github.com/<compte>/hope-and-peace-farm.git
   git push -u origin main
   ```

Chaque envoi sur `main` déclenchera un déploiement.

Contenu de la page (phase 3) : au premier démarrage, l’application publie elle-même le contenu de la maquette (version n° 1) si la base est vide ; rien à faire. Le diagnostic (`/api/sante` avec jeton, `npm run deploiement:verifier`) indique la version en ligne et la présence de l’instantané de secours dans `UPLOAD_DIR/.contenu/`.

Répartition convenue le 12/10/2026 : vous créez le dépôt (privé, vide) et faites les étapes Hostinger ; je pousse le code sur ce dépôt à la fin de chaque phase, sans jamais toucher au compte Hostinger.

## 2. Base MySQL

hPanel → **Sites web** → le site → **Bases de données** → **Bases de données MySQL** :

1. Créer une base et un utilisateur (mot de passe généré, 20 caractères au moins).
2. Noter : nom de la base (`u123456789_hpf`), utilisateur (`u123456789_hpf`), mot de passe. L’hôte est `localhost`.
3. Noter la version affichée par phpMyAdmin (MySQL ou MariaDB).

Rien à créer à la main : les tables sont créées au premier démarrage de l’application.

## 3. Boîte e-mail (dès que le domaine existe)

hPanel → **E-mails** : créer une boîte, par exemple `contact@<domaine>`. Paramètres SMTP Hostinger : `smtp.hostinger.com`, port `465` (TLS). Vérifier que les enregistrements **SPF, DKIM et DMARC** sont actifs (hPanel → E-mails → configuration DNS) : sans eux, les notifications risquent les indésirables.

## 4. Variables d’environnement

Préparer un fichier `deploiement.env` **hors du dépôt** (il est ignoré par Git), à partir de `.env.example` :

| Variable | Valeur |
| --- | --- |
| `SITE_URL` | adresse du site (temporaire ou domaine), sans barre finale |
| `SITE_INDEXABLE` | `0` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | étape 2 (`localhost`, `3306`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | étape 3 (laisser vide en attendant le domaine) |
| `NOTIFICATION_EMAIL` | adresse qui reçoit les demandes |
| `UPLOAD_DIR` | `/home/<utilisateur>/domains/<domaine>/televersements` (voir ci-dessous) |
| `CRON_SECRET`, `DIAGNOSTIC_SECRET` | deux secrets différents, générés par `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `TACHES_MINUTEUR_MINUTES` | `0` |
| `DEMANDES_SECRET` | un troisième secret, même commande (vide : dérivé de `CRON_SECRET`) |
| `AUTH_SECRET` | un quatrième secret, même commande (phase 5, **obligatoire** pour le back-office). **Ne jamais le changer** ensuite : les seconds facteurs (TOTP) des comptes deviendraient illisibles |
| `IP_ENTETE`, `IP_PROXYS` | `x-forwarded-for` et `1`, à confirmer à l’étape 6 (encadré ci-dessous) |
| `DEMANDES_CONSERVATION_MOIS` | `12` |

`<utilisateur>` est l’identifiant du compte (`u123456789`), visible dans hPanel (Comptes FTP ou Accès SSH). Si vous ne le trouvez pas, déployez une première fois sans `UPLOAD_DIR` : le diagnostic affiche le dossier de l’application (`/home/u…/domains/…/hbuilds/…`), d’où l’on déduit le chemin.

## 5. Créer l’application Node.js

hPanel → **Sites web** → **Ajouter un site web** → **Application web Node.js** → **Importer un dépôt Git** :

1. Autoriser l’application GitHub de Hostinger **sur ce seul dépôt**.
2. Réglages (normalement détectés) :

   | Réglage | Valeur |
   | --- | --- |
   | Préréglage | Next.js |
   | Branche | `main` |
   | Version de Node.js | **24** |
   | Dossier racine | `/` |
   | Script de compilation | `build` |
   | Dossier de sortie | `.next` |
   | Fichier d’entrée | (vide : ignoré pour Next.js) |
   | Gestionnaire de paquets | npm (détecté par `package-lock.json`) |

3. **Variables d’environnement** → **Importer .env** → `deploiement.env`.
4. Déployer et suivre le journal de compilation (copier ses dernières lignes dans le rapport de phase).

## 6. Vérifier

Depuis le dossier du projet, avec les secrets dans `deploiement.env` sous les noms `HPF_DIAGNOSTIC_SECRET` et `HPF_CRON_SECRET` :

```sh
node --env-file=deploiement.env scripts/verifier-deploiement.mjs https://<adresse-du-site> --taches --cache --json=verification-1.json
```

Le script contrôle la page, les en-têtes, la police, robots.txt, la base, les migrations, `UPLOAD_DIR`, sharp, le SMTP, les en-têtes IP et le cache, et classe chaque point en OK, ÉCHEC ou À VOIR. Ajouter `--email` dès que le SMTP est configuré, puis vérifier la réception (et le dossier indésirables).

Sans le script, le rapport brut s’ouvre dans un navigateur : `https://<adresse-du-site>/api/sante?jeton=<DIAGNOSTIC_SECRET>`.

**Adresse du visiteur (phase 4, limite de 10 demandes par heure et par adresse).** Ouvrir le rapport brut depuis un téléphone en 4G (Wi-Fi coupé), puis depuis un ordinateur : la rubrique des en-têtes IP montre `x-forwarded-for` avec des adresses tronquées. Si la **dernière** adresse de la liste change d’un appareil à l’autre et correspond au début de l’adresse publique de l’appareil, `IP_PROXYS=1` est juste. Si elle reste la même (adresse du proxy, souvent `127.0.x.x` ou `10.x.x.x`), essayer `IP_PROXYS=2` ; si aucune ne convient, mettre `IP_PROXYS=0` : la limite par adresse est alors désactivée (restent le champ piège, le délai minimal et la limite de 3 demandes par jour et par numéro). Un visiteur bloqué par erreur n’est jamais perdu : avec JavaScript, son message WhatsApp reste prêt ; sans JavaScript, la page lui propose WhatsApp.

**Back-office (phase 5).** Après le déploiement, créer le premier compte Propriétaire depuis le terminal SSH de Hostinger (hPanel → Avancé → Accès SSH), dans le dossier de l’application, avec les variables du site :

```sh
npm run admin:creer -- <votre-email> "<Prénom Nom>"
```

Le mot de passe provisoire s’affiche une seule fois. Sans accès SSH : lancer la même commande depuis ce poste avec les variables de la base de production (`node --env-file=deploiement.env --import ./scripts/lib/chargeur-ts.mjs scripts/admin-creer.mjs <email> "<Prénom Nom>"`), si la base accepte les connexions distantes (hPanel → Bases de données → MySQL distant ; refermer ensuite). Puis ouvrir `https://<adresse-du-site>/admin` : mot de passe provisoire, activation du second facteur (QR code à scanner, 10 codes de secours à noter), puis Sécurité → changer le mot de passe. Vérifier que `/admin` sans session renvoie bien vers `https://<adresse-du-site>/admin/connexion` (et non vers une adresse interne en `localhost`) : la redirection est faite par le serveur à partir de l’adresse de la requête.

**Formulaires (phase 4).** Envoyer une demande depuis le site (avec un vrai numéro WhatsApp) : la vue « Votre message est prêt » doit montrer « (Réf. HP-…) » à la fin du message, et l’e-mail « Nouvelle demande … — HP-… » doit arriver à `NOTIFICATION_EMAIL` dans la minute. Sans SMTP configuré, la demande est quand même enregistrée (e-mail non mis en file).

## 7. Cron

hPanel → **Avancé** → **Tâches cron** → type **Personnalisé**, toutes les 15 minutes (`*/15 * * * *`) :

```sh
curl -fsS -m 120 -X POST -H "Authorization: Bearer <CRON_SECRET>" https://<adresse-du-site>/api/taches > /dev/null
```

Si le menu des tâches cron n’est pas proposé pour l’application Node.js, le créer depuis un autre site du même compte (la commande appelle une URL, elle fonctionne de n’importe où). Vingt minutes plus tard, le script de l’étape 6 doit afficher « cron : OK ».

Dernier recours, si aucun cron n’est possible : `TACHES_MINUTEUR_MINUTES=15`. Les tâches ne tourneront alors que pendant les périodes où le site reçoit des visites.

## 8. Deuxième déploiement : persistance d’`UPLOAD_DIR`

Relancer un déploiement (hPanel → Déploiements → Redéployer, ou un nouvel envoi sur `main`), puis relancer le script : la ligne « UPLOAD_DIR conservé après un déploiement » doit passer à OK (le marqueur du dossier contient alors deux identifiants de compilation).

Si elle reste en échec, les photos seront stockées en base (plan B de l’architecture).

## 9. Mise en veille

Laisser le site sans visite pendant une heure, puis relancer le script : la liste des démarrages montre si le processus a été arrêté puis relancé, et le temps de réponse de la première page après la veille.

## 10. Mesures en ligne

Une fois l’adresse publique disponible : PageSpeed Insights (mobile et ordinateur) sur la page d’accueil, à consigner dans `PROGRESS.md`.
