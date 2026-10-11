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

## Pile

- Next.js (App Router) + React + TypeScript strict. Composants serveur par défaut ; `"use client"` seulement pour l’interactif.
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
- Chrome est installé : Playwright et Lighthouse l’utilisent (`channel: "chrome"`).

## Commandes

- `npm run maquette:extraire` : extrait polices, logo, icônes, CSS et JS de la maquette.
- `npm run maquette:captures` : captures de référence (4 formats × 3 modes) dans `reference/captures/`.
- `npm run maquette:mesures` : Lighthouse mobile et ordinateur, axe-core, poids.
- `npm run maquette:diagnostic [-- --variantes=base,sans-local]` : coût de chaque ingrédient (copies de la maquette).
