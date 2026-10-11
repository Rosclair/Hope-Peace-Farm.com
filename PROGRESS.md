# Suivi du projet

**État : phase 0 (cadrage) terminée — en attente de « GO phase 1 » et des réponses aux 3 questions de [docs/risques-et-questions.md](docs/risques-et-questions.md#5-questions-3).**

| Phase | Contenu | État |
| --- | --- | --- |
| 0 | Cadrage, extraction, captures et mesures de référence | terminée (11/10/2026) |
| 1 | Squelette déployé sur Hostinger | en attente du GO |
| 2 | Portage fidèle de la page, tests de parité | — |
| 3 | Contenus en base, publication, retour arrière | — |
| 4 | Formulaires, demandes, e-mail, WhatsApp | — |
| 5 | Back-office : connexion, tableau de bord, demandes, contenus, publication | — |
| 6 | Back-office : listes, photos, campagnes, statistiques, journal | — |
| 7 | SEO, performance, accessibilité, sécurité, recette | — |
| 8 | Mise en production, README, guide du propriétaire | — |

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

## Décisions

Voir aussi [docs/risques-et-questions.md §4](docs/risques-et-questions.md#4-décisions-prises-par-défaut-option-la-plus-prudente).

- Contenu publiable = un document JSON validé par Zod, versionné par instantanés (publication et retour arrière atomiques).
- Tous les textes de la page modifiables, sauf libellés des formulaires, messages WhatsApp pré-remplis, ancres et menu.
- Valeurs citées dans les textes par repères `{groupe.cle}`.
- Formulaires sans JS : vrais `<form method="post">`, redirection vers `/demande/confirmation` (écart voulu avec la maquette).
- Fêtes : classes posées par le serveur au rendu + script de tête + revalidation aux dates de bascule (21/12/2026 0 h et 01/11/2026 0 h, heure de Douala).
- Captures PNG non versionnées (≈ 45 Mo, régénérables par `npm run maquette:captures`) ; leur manifeste (empreintes SHA-256) est versionné. Rapports HTML Lighthouse non versionnés ; `mesures.json` versionné.
- Identité Git locale provisoire : `ieeservices2019` / `ieeservices2019@gmail.com` (à changer si besoin : `git config user.name`).

## Mesures de référence (maquette)

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

## Contrôles exécutés en phase 0

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

- Phase 1 dès le GO : voir brief §7 et [architecture §16](docs/architecture.md#16-hypothèses-hostinger-à-vérifier-en-phase-1) (hypothèses Hostinger à vérifier en premier).

## Blocages

- Réponses attendues aux 3 questions (accès, domaine non enregistré, hébergement hors Cameroun).
- Réseau du poste très lent (14,5 Ko/s mesurés) : Next.js n’est pas dans le cache npm local.
