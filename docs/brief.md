# Hope & Peace Farm — site vitrine en React et back-office, à construire de zéro

## Contexte
Hope & Peace Farm est une ferme avicole à Bangangté (Ndé, Ouest-Cameroun). Elle vend des poulets de chair (vivants, prêts à cuire ou découpés) aux familles, aux organisateurs de cérémonies, souvent à distance (Douala, Yaoundé, étranger), et aux professionnels (restaurants, braiseurs, hôtels). Le site doit rassurer un inconnu, recueillir une demande précise et l'envoyer sur WhatsApp avec un message prêt à partir : c'est WhatsApp qui conclut la vente. Les visiteurs utilisent surtout des Android d'entrée de gamme en 3G/4G, souvent depuis le navigateur intégré de Facebook. Tout est en français, avec vouvoiement, et le ton reste sobre pour les funérailles.

## Ce que je te fournis
Le dossier de travail est vide. Le seul fichier est la maquette jointe, `hope-and-peace-farm-apercu-2.html` : une page unique déjà validée, en HTML, CSS et JavaScript natifs, avec les polices en base64 et le logo en SVG dans la page.

## Mission
1. Recréer cette page en React avec Next.js, à l'identique : même rendu, mêmes textes, mêmes animations, mêmes comportements.
2. La faire fonctionner pour de vrai : chaque demande est enregistrée, notifiée par e-mail et envoyée sur WhatsApp avec une référence.
3. Construire de zéro le back-office qui va avec : suivi des demandes et modification de tout le contenu de la page, sans toucher au code.

Commence par enregistrer ce message dans `docs/brief.md` et la maquette, sans la modifier, dans `reference/`.

## 1. La maquette fait foi pour tout ce qui se voit
- Extrais-la d'abord avec un script : polices WOFF2, SVG du logo, CSS et JavaScript. Ne lis pas les lignes en base64.
- Reprends les textes mot pour mot. Seules corrections permises : apostrophe typographique ’, espace insécable avant `:` `;` `?` `!` et à l'intérieur des guillemets « ».
- Garde les ancres (`#accueil`, `#ceremonies`, `#poulets`, `#professionnels`, `#livraison`, `#la-ferme`, `#questions`, `#demande`…), les classes CSS et les attributs `data-cta`, qui servent à la mesure.
- Son JavaScript est la référence des comportements : menu, barre fixe WhatsApp/Appeler, onglets et étapes des formulaires, composition des messages WhatsApp, accueil animé, apparitions au défilement.

## 2. Pile technique
- Next.js (App Router, dernière version stable), React et TypeScript strict. Composants serveur par défaut ; `"use client"` seulement pour l'interactif : formulaires, menu, barre fixe.
- Animations : le moteur de la maquette (logo qui s'assemble, accueil épinglé piloté par le défilement, logo qui se range dans l'en-tête, carte de suivi qui se coche, apparitions, barre de lecture) est porté tel quel en module TypeScript natif, lancé une seule fois côté client. Pas d'état React pendant le défilement, ni Framer Motion ni GSAP : seulement `transform` et `opacity`. Avec « réduire les animations » ou sans JavaScript, la page s'affiche directement dans son état final, comme la maquette.
- Garde le script de tête qui pose les classes `js`, `motion`, `scrolly` et celles des Fêtes avant le premier rendu (mets `suppressHydrationWarning` sur `<html>`).
- Porte le CSS de la maquette avec les mêmes classes. Polices auto-hébergées avec `next/font/local`.
- Données : MySQL/MariaDB avec Drizzle ORM, migrations versionnées et script de données initiales.
- Authentification : une bibliothèque maintenue (Better Auth ou équivalent), sessions en base, double authentification TOTP obligatoire et codes de secours.
- Zod pour toutes les validations, Nodemailer (SMTP) pour les e-mails, sharp pour les images.
- Hébergement prévu : Hostinger, offre Business : application Node.js déployée depuis GitHub, base MySQL, boîte e-mail du domaine, tâches cron. Le déploiement écrase les dossiers qu'il gère : les fichiers téléversés vont donc dans un dossier persistant (`UPLOAD_DIR`). Si l'une de ces hypothèses ne tient pas, dis-le-moi avant la phase 1.
- Le navigateur ne charge aucune ressource tierce : ni script, ni police, ni traceur, ni iframe. Seuls liens sortants : WhatsApp, Facebook, la chaîne WhatsApp, Google Maps et le téléphone.

## 3. Le site public
- La page est servie en HTML complet, généré côté serveur et mis en cache. Aucun contenu n'est chargé après coup par JavaScript. Après un clic sur « Publier » dans le back-office, la page est à jour en moins d'une minute.
- Les trois formulaires (Cérémonie, Poulets, Pro), en onglets et en deux étapes, gardent leurs libellés. Ce qu'il faut ajouter maintenant que les demandes sont enregistrées :
  - un champ « Numéro WhatsApp » obligatoire à la dernière étape. Normalisation : retirer espaces, points, tirets et parenthèses ; `00` devient `+` ; neuf chiffres commençant par 6 ou 2 reçoivent `+237` ; `+` suivi de 8 à 15 chiffres est accepté (diaspora) ;
  - une case obligatoire « J'accepte d'être contacté sur WhatsApp au sujet de ma demande. » La case des annonces reste facultative et décochée ;
  - un texte de confidentialité réécrit : ce qui est enregistré, pourquoi, pour combien de temps, et comment en demander la suppression. Je le validerai ;
  - un anti-spam sans service tiers : champ piège, délai minimal, limite de débit par empreinte d'IP (jamais l'adresse en clair) et par numéro, contrôle de l'origine.
- Après l'envoi :
  - la demande reçoit une référence `HP-AAMMJJ-XXXXXX` (six caractères aléatoires) ;
  - un e-mail part au propriétaire ;
  - la vue de succès de la maquette s'affiche, avec « Ouvrir WhatsApp et envoyer » et « Copier le message » ;
  - le message reste celui de la maquette, suivi de « (Réf. …) » ;
  - WhatsApp ne s'ouvre jamais tout seul.
- Sans réseau, ou si le serveur échoue : le navigateur construit lui-même le lien WhatsApp (sans référence), garde la saisie et propose « Réessayer ».
- Sans JavaScript : la page se lit entièrement et les formulaires s'envoient quand même (amélioration progressive), puis mènent à une page de confirmation avec le bouton WhatsApp.
- Mesure maison, sans cookie publicitaire ni donnée personnelle : vues, clics par `data-cta`, entonnoir des formulaires, source de la visite (`?src=`, `utm_*`, site d'origine). Envoi groupé par `sendBeacon`.
- SEO : titre, description, Open Graph, URL canonique, JSON-LD `LocalBusiness`, `sitemap.xml` et `robots.txt`. Domaine prévu : hopeandpeacefarm.com, à vérifier. `/admin` et la page de confirmation sont en `noindex`.
- Une donnée absente cache son bloc. Jamais de faux contenu, d'avis inventé ni de photo de banque d'images.

## 4. Le back-office (`/admin`)
Interface en français, simple, pensée d'abord pour le téléphone. Deux rôles : Propriétaire (tout) et Équipe (demandes seulement).
1. Connexion et sécurité : mot de passe haché (argon2id ou scrypt), TOTP obligatoire, 10 codes de secours, verrouillage après 5 échecs, sessions actives révocables.
2. Tableau de bord : nouvelles demandes, demandes à relancer (plus de 24 h sans changement), e-mails en échec, valeurs « à confirmer », dernières modifications.
3. Demandes :
   - liste filtrable par statut, type, source et date, et fiche complète ;
   - statuts avec historique : Nouvelle, Contactée, Devis envoyé, Acompte reçu, En préparation, Livrée, Perdue ;
   - note interne et bouton « Écrire sur WhatsApp » ;
   - export CSV (UTF-8 avec BOM, point-virgule, formules neutralisées) ;
   - suppression des données d'un client, à sa demande.
4. Contenus : chaque valeur affichée qui peut changer (coordonnées, horaires, délais promis, liens sociaux, prix « à partir de », garanties, engagements, conditions, paiement, saison des Fêtes et ses dates, mentions légales). Chacune a une aide, une validation et un badge « à confirmer ».
5. Listes :
   - FAQ, avec les 4 groupes de la maquette ;
   - zones de livraison ;
   - avis clients, publiés seulement avec l'accord écrit du client ;
   - photos : réduction dans le navigateur, variantes WebP, texte alternatif obligatoire, ordre par glisser-déposer ;
   - carte du promoteur.
6. Publier : brouillon et version en ligne séparés, aperçu du brouillon, contrôles avant publication (champs obligatoires, aucun `[…]` restant, aucune photo sans texte alternatif), historique des versions et retour arrière.
7. Liens de campagne : liens courts `/go/{code}` avec QR code téléchargeable en SVG, pour les flyers et Facebook.
8. Statistiques : visites et clics par source et par bouton, entonnoir des formulaires, export CSV.
9. Journal d'audit : qui a changé quoi et quand, avec l'avant et l'après (valeurs sensibles masquées).

Pour changer le numéro WhatsApp, l'e-mail de notification ou les numéros de paiement, il faut ressaisir le code TOTP ; l'action envoie un e-mail d'alerte et s'inscrit au journal. Toute suppression demande une confirmation.

## 5. Données de départ
- Tout le contenu de la maquette devient les données initiales : à la première publication, la page est identique à la maquette.
- Valeurs connues :
  - WhatsApp : `237693645565` ;
  - téléphone : le même numéro, à confirmer ;
  - Facebook : https://www.facebook.com/share/19txTSFrCX/ ;
  - chaîne WhatsApp : https://whatsapp.com/channel/0029Vb8zdD9Au3aZ2Jubpu1U ;
  - Fêtes : prix garanti avant le 1er novembre 2026 ; bandeau et bloc masqués après le 20 décembre 2026, avec bascule à minuit, heure de Douala.
- À importer avec le badge « à confirmer » : prix « à partir de » ; frais, minimums et jours de livraison ; conditions d'acompte et d'annulation ; délais promis de réponse et de devis.
- Vides dans la maquette, à saisir dans le back-office (le bloc reste masqué tant qu'ils sont vides) : responsable de la publication, e-mail de contact, hébergeur, numéros MTN et Orange et nom du compte, promoteur, photos, lien d'itinéraire, avis.

## 6. Exigences de qualité
- Parité visuelle. Prends des captures Playwright de la maquette et du site :
  - à 360 × 640, 393 × 780, 768 × 1024 et 1280 × 800 ;
  - à 0, 14, 38, 66 et 97 % de la course de l'accueil animé, puis sur chaque section ;
  - avec et sans JavaScript, et en mouvement réduit.
  Chaque écart est corrigé ou justifié.
- Performance. Sur Lighthouse et PageSpeed Insights, mobile et ordinateur, l'objectif est 100 dans les quatre catégories :
  - Accessibilité, Bonnes pratiques et SEO : 100 obligatoires ;
  - Performance mobile : 95 au minimum, avec la cause mesurée de tout écart ;
  - LCP sur le titre (du texte), CLS de 0,02 au plus, poids du JavaScript client mesuré et consigné.
- Accessibilité WCAG 2.2 AA : axe-core sans violation, sur le site et le back-office ; navigation au clavier seul ; lecteurs d'écran ; zoom à 200 % ; aucun défilement horizontal de 320 à 1 920 px.
- Compatibilité : Chrome Android, Samsung Internet, navigateurs intégrés de Facebook et d'Instagram, Safari iOS 15 et plus.
- Sécurité :
  - en-têtes CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy et frame-ancestors, sans casser la page en cache ;
  - protection CSRF et requêtes paramétrées ;
  - images ré-encodées, taille limitée ;
  - secrets uniquement dans `.env` ;
  - journaux sans donnée personnelle ;
  - durée de conservation des demandes réglable, 12 mois par défaut.
- Données personnelles : loi camerounaise n° 2024/017 (consentement, finalité, conservation, droits d'accès, de correction et de suppression).
- Tests unitaires : normalisation des numéros, messages WhatsApp, référence, export CSV, contrôles de publication.
- Tests de bout en bout : trois formulaires avec et sans JavaScript, connexion avec TOTP, publication qui met la page à jour, parité visuelle.

## 7. Méthode
- Tout en français : interface, documentation, messages de commit.
- `CLAUDE.md` contient les règles permanentes (moins de 80 lignes, avec un renvoi vers `docs/brief.md`). `PROGRESS.md` suit ce qui est fait, les décisions, ce qui reste, les mesures et les blocages. Mets-les à jour à chaque étape.
- Travaille par phases. À la fin de chacune :
  - exécute les contrôles et consigne leurs résultats ;
  - fais un commit Git ;
  - rédige un rapport court ;
  - arrête-toi jusqu'à mon « GO ».
- Ne dis jamais qu'une chose marche sans l'avoir vérifiée.
- Pose trois questions au plus à la fois, et seulement si la réponse change le travail. Sinon, choisis l'option la plus prudente et consigne-la.
- Phases proposées :
  - phase 0 : cadrage, sans code applicatif ;
  - phase 1 : squelette déployé sur Hostinger (Next.js, base, e-mail, cron, dossier de téléversement persistant, dépendances natives vérifiées) ;
  - phase 2 : portage fidèle de la page et tests de parité ;
  - phase 3 : contenus en base, publication et retour arrière ;
  - phase 4 : formulaires, demandes, e-mail et WhatsApp ;
  - phase 5 : back-office (connexion, tableau de bord, demandes, contenus, publication) ;
  - phase 6 : back-office (listes, photos, campagnes, statistiques, journal) ;
  - phase 7 : SEO, performance, accessibilité, sécurité et recette ;
  - phase 8 : mise en production, `README.md` (installation, déploiement, cron, sauvegarde et restauration) et guide du propriétaire en une page.

## 8. Maintenant : phase 0 seulement
1. Range la maquette et ce brief, puis extrais les polices, le logo, le CSS et le JavaScript.
2. Prends les captures de référence de la maquette et mesure-la avec Lighthouse.
3. Propose l'architecture, le modèle de données et un tableau qui relie chaque section de la page à ses composants et à ses champs du back-office.
4. Liste les risques, les données et les accès qui me manquent, et tes questions.

Puis arrête-toi et attends mon « GO phase 1 ».
