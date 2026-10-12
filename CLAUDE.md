# Hope & Peace Farm — règles permanentes

Brief complet et exigences : [docs/brief.md](docs/brief.md). Suivi : [PROGRESS.md](PROGRESS.md).
Architecture : [docs/architecture.md](docs/architecture.md) · données : [docs/modele-donnees.md](docs/modele-donnees.md) · sections : [docs/correspondance-sections.md](docs/correspondance-sections.md).

## Méthode

- Tout en français : interface, documentation, commentaires, messages de commit.
- Travail par phases (brief §7). Fin de phase : contrôles exécutés et consignés dans PROGRESS.md, commit, rapport court, puis arrêt jusqu’au « GO ».
- Ne jamais affirmer qu’une chose marche sans l’avoir vérifiée (commande, test ou capture à l’appui).
- Trois questions au plus à la fois, seulement si la réponse change le travail ; sinon option la plus prudente, consignée dans PROGRESS.md.
- Mettre à jour PROGRESS.md (fait, décisions, reste, mesures, blocages) à chaque étape.

## La maquette fait foi

- `reference/hope-and-peace-farm-apercu-2.html` : ne jamais la modifier (empreinte SHA-256 dans `reference/extrait/manifeste.json`).
- Ne pas lire ses lignes base64 (43, 50, 57) ni la ligne 1996 (tracés du logo) : utiliser `reference/extrait/` (régénérer : `npm run maquette:extraire`).
- Textes mot pour mot. Seules corrections : apostrophe ’, espace insécable avant `:` `;` `?` `!` et dans « ».
- Garder ancres, classes CSS et attributs `data-cta`, `data-demande`, `data-primary-cta`, `data-reveal`, `data-stagger`, `data-animate`.
- Comportements : `reference/extrait/principal.js` est la référence ; tout écart visuel est corrigé ou justifié dans PROGRESS.md.
- Fichiers générés, jamais modifiés à la main : `app/maquette.css` et `lib/site/sprite.ts` (`npm run maquette:extraire`), `lib/site/moteur-immediat.ts` (`npm run moteur:construire`, après toute modification de `lib/moteur/`). Ajouts de style du site : `app/site.css`.

## Pile

- Next.js 16.4 (App Router, `cacheComponents`, sortie standalone) + React 19 + TypeScript strict. Composants serveur par défaut ; `"use client"` seulement pour l’interactif. Avant d’employer une API de Next, lire sa documentation dans `node_modules/next/dist/docs/` (elle diffère des versions antérieures).
- Animations : moteur natif en TypeScript (`lib/moteur/`), lancé une fois côté client. Pas d’état React au défilement, ni Framer Motion ni GSAP ; uniquement `transform` et `opacity`.
- MySQL/MariaDB + Drizzle (migrations versionnées dans `drizzle/`), Better Auth (sessions en base, TOTP obligatoire), Zod partout, Nodemailer, sharp.
- Aucune ressource tierce chargée par le navigateur. Liens sortants permis : WhatsApp, Facebook, chaîne WhatsApp, Google Maps, téléphone.

## Règles de code

- Une donnée absente cache son bloc. Jamais de faux contenu, d’avis inventé ni de photo de banque d’images.
- Secrets uniquement dans `.env` (modèle : `.env.example`). Journaux sans donnée personnelle (référence de demande seulement).
- Adresses IP jamais stockées en clair (empreinte HMAC avec sel tournant).
- Validation Zod côté serveur pour toute entrée, même déjà validée côté client.
- Toute suppression demande une confirmation ; toute modification du back-office s’inscrit au journal d’audit.
- Numéro WhatsApp, e-mail de notification et numéros de paiement : ressaisie TOTP + e-mail d’alerte + journal.

## Environnement local (Windows)

- Lancer npm, npx et node depuis Git Bash (outil Bash) : depuis PowerShell, npm s’est bloqué sans message dans ce dossier (dont le chemin contient `&`).
- Avant tout script npm qui appelle un exécutable (`next`, `tsc`, `vitest`, `drizzle-kit`, `npx`) : `export npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe"` (sinon cmd.exe coupe le chemin au `&`). Réglage local seulement : rien dans `.npmrc`.
- Réseau lent et coupures : installer avec `--prefer-offline` ; une grosse archive se télécharge par morceaux (`curl -r`), puis `npm cache add` (npm la retrouve par son empreinte).
- Chrome est installé : Playwright et Lighthouse l’utilisent (`channel: "chrome"`).
- MySQL 8.4 de Laragon : base `hpf_dev`, utilisateur `hpf_dev` (identifiants dans `.env`). Ne jamais toucher la base `hopeandpeacefarm`, qui appartient à un autre projet.
- E-mails de test : Mailpit dédié, `C:/laragon/bin/mailpit/1.22.3/mailpit.exe --smtp 127.0.0.1:1026 --listen 127.0.0.1:8026 --smtp-auth-accept-any --smtp-auth-allow-insecure` (celui de Laragon, ports 1025/8025, est partagé avec les autres projets du poste).

## Commandes

- `npm run dev` · `npm run build` (puis copie des fichiers statiques dans la sortie standalone) · `npm run standalone` : serveur standalone, celui que Hostinger exécute.
- `npm test` (Vitest) · `npm run typecheck` · `npm run test:e2e` (Playwright, contre `HPF_SITE_URL`, défaut `http://127.0.0.1:3100`).
- `npm run site:parite -- --site=<url>` : parité maquette / site (DOM, géométrie, textes, captures), rapport dans `reference/parite/` · `npm run site:demarrage` : délai de démarrage du moteur en conditions mobiles.
- `npm run db:generer` : nouvelle migration depuis `lib/db/schema/` · `npm run db:migrer` : l’applique (aussi faite au démarrage du serveur).
- `npm run deploiement:verifier -- <url> [--email] [--taches] [--cache]` : contrôle d’un déploiement (jetons `HPF_DIAGNOSTIC_SECRET`, `HPF_CRON_SECRET`), voir `docs/deploiement-hostinger.md`.
- `npm run site:mesures -- <url> [--passages=3] [--sortie=f.json]` : Lighthouse et poids du JS client du site.
- `npm run maquette:extraire` : extrait polices, logo, icônes, CSS et JS de la maquette.
- `npm run maquette:captures` : captures de référence (4 formats × 3 modes) dans `reference/captures/`.
- `npm run maquette:mesures` : Lighthouse mobile et ordinateur, axe-core, poids.
- `npm run maquette:diagnostic [-- --variantes=base,sans-local]` : coût de chaque ingrédient (copies de la maquette).
