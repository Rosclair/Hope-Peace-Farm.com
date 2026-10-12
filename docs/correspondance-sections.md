# Correspondance : sections de la page → composants → champs du back-office

Ordre de la maquette. Mis à jour en phase 2 avec les composants écrits et les chemins réels du document de contenu (`lib/contenu/types.ts`, contenu initial `lib/contenu/initial.ts`). Tous les composants listés sont des composants serveur ; les comportements viennent du moteur (`lib/moteur/`), lancé par le seul composant client `Comportements`.

⚠ = importé avec le badge « à confirmer » (phase 3). ∅ = vide au départ, bloc masqué tant qu’il est vide. Les textes acceptent les repères `{groupe.cle}` (liste : `lib/contenu/reperes.ts`), `**gras**` et `[libellé](#ancre)`.

## Cadre de la page

| Élément (sélecteur, ancre) | Composant | Champs du back-office | `data-cta` et comportements |
| --- | --- | --- | --- |
| `<html data-wa data-fetes-deadline data-fetes-end>`, `<head>` (titre, description, Open Graph, canonique) | `app/layout.tsx`, `generateMetadata` de `app/page.tsx` | `seo.titre`, `seo.description`, `coordonnees.whatsapp`, `fetes.actif`, `fetes.dateLimitePrixGaranti`, `fetes.dateFin` | script de tête repris à l’identique (`js`, `motion`, `scrolly`, `fetes-garanti`, `fetes-fin`) |
| JSON-LD `LocalBusiness` + `WebSite` | `JsonLd` (`cadre.tsx`) | `seo.descriptionEntreprise`, `seo.zonesDesservies`, `coordonnees.telephone` ⚠, `facebook`, `chaineWhatsapp`, `pied.signature` | — |
| Sprite SVG (logo 13 calques, 24 icônes) | `Sprite` (`lib/site/sprite.ts`, généré depuis la maquette) | — (code) | — |
| `.skip-link` « Aller au contenu » | `app/page.tsx` | — | — |
| `.banner` Bandeau des Fêtes | `BandeauFetes` | `fetes.bandeau.annonce`, `fetes.garantie` (avec `{fetes.dateLimitePrixGaranti}`), `fetes.bandeau.lien` | masqué par `fetes-fin` ; phrase de garantie par `fetes-garanti` |
| `.header` : marque, `.nav`, « Commander », `details.menu` | `EnTete` | `coordonnees.whatsapp`, `facebook`, `chaineWhatsapp` ; libellés du menu dans le code (liés aux ancres) | `menu_wa`, `menu_facebook`, `menu_channel` ; `data-demande="poulets"` ; moteur : `inert` derrière le menu, Échap, fermeture au clic, section courante (`aria-current`) |
| `.header__progress` barre de lecture | dans `EnTete` | — | moteur : `--read`, `is-scrolled` |
| `.dock-logo` | `LogoVolant` | — | moteur : logo qui se range dans l’en-tête |

## Sections de `<main id="contenu">`

| Section (ancre) | Composants (fichier) | Champs du back-office | `data-cta` et comportements |
| --- | --- | --- | --- |
| **Accueil** `#accueil` `.hero` | `Accueil` (`accueil.tsx`) | `accueil.surTitre`, `titre[]` (une ligne par `<span>`), `chapeau`, `boutonPrincipal`, `lienWhatsapp` ; `accueil.suivi` : `etiquette`, `titre`, `detail`, `etapes[]` (`quoi`, `quand`), `pied` | `hero_wa` ; `data-demande="ceremonie"`, `data-primary-cta` ; moteur : landing épinglée (`--dock`, `--out`, `--card`, `--s`, `--f`, `--foot`) ; CSS : assemblage du logo |
| **Nos garanties** `.assurance` | `Garanties` | `garanties.titre`, `garanties.elements[]` (icône du sprite, texte : `{delais.devis}` ⚠, `{conditions.acomptePourcent}` ⚠) | apparitions décalées (`data-stagger`) |
| **Que préparez-vous ?** | `Portes` | `choix.titre`, `choix.portes.{ceremonie,maison,pro}` (`titre`, `texte`, `prix` : `À partir de {prix.pretACuire}` ⚠), `choix.etranger` (`question`, `lien`) | `home_video` |
| **Comment ça marche** | `Deroule` | `deroule.titre`, `deroule.etapes[]` | `data-animate` : numéros et fil tracé |
| **Cérémonies** `#ceremonies`, `#formules`, `#exemple`, `#distance` | `Ceremonies` (`ceremonies.tsx`) | `ceremonies` : `surTitre`, `titre`, `chapeau`, `bouton` ; `formules.liste[3]` (`nom`, `pourQui`, `plus`, `elements[]`, `delai`) ; `formules.tableau[]` (`critere`, 3 `valeurs`, vide = « Non ») ; `formules.conditions[]` (`{conditions.soldeJoursAvant}`, `{conditions.minimumCeremonie}`, `{conditions.minimumHorsNde}`) ⚠ ; `methode` ; `exemple` (**calculé** : `quantite` × `{prix.pretACuire}`, acompte `{conditions.acomptePourcent}`, solde) ⚠ ; `distance` | `cer_video` ; `data-demande="ceremonie"` |
| **Poulets et Fêtes** `#poulets`, `#fetes` | `Poulets` (`offres.tsx`) | `poulets` : `surTitre`, `titre`, `chapeau`, `bouton`, `preparations.liste[]` (`nom`, `description`, `prix` : `{prix.vivant}`… ⚠), `preparations.calibres`, `preparations.prixFinal` ; `fetes.bloc` (`titre`, `texteAvant`, `texteApres`, libellés des clôtures, `bouton`), `fetes.garantie`, `fetes.clotureNoel`, `fetes.clotureNouvelAn` | `fetes_reserver` (message avec garantie choisi par le moteur selon la date, comme la maquette) ; `data-demande="poulets"` ; bloc masqué par `fetes-fin` ou `fetes.actif` |
| **Professionnels** `#professionnels` | `Professionnels` (`offres.tsx`) | `pro` : `surTitre`, `titre`, `chapeau` (`{conditions.prixFixeSemaines}` ⚠), `bouton`, `garanties` (4), `essai` | `data-demande="pro"` |
| **Livraison et paiement** `#livraison`, `#zones`, `#paiement`, `#payer` | `Livraison` (`offres.tsx`, schéma des zones dans le code) | `livraison.zones[]` (`nom`, `regle`) ⚠ ; `note` ; `minimums` ; `paiement.regles[]` (`cas`, `regle`) ⚠ ; `annulation.paliers[]` (`{conditions.seuilRemboursementJours}`, `{conditions.seuilConserveJours}`, `{conditions.avoirMois}`) ⚠ ; `securite` (`moyens`, ou `moyensAvecCompte` quand `paiement.nomCompte` ∅ est rempli, `regle`, `conseils`, `numero`, `bouton`) ; ligne « MTN : … · Orange : … » si `paiement.mtn` ∅ / `paiement.orange` ∅ | `pay_video` ; `data-animate` sur le schéma |
| **La ferme** `#la-ferme`, `#engagements` | `Ferme` (`ferme.tsx`) | `ferme` : `surTitre`, `titre`, `texte` ; `promoteur` ∅ (phase 6) ; photos ∅ et avis ∅ (phase 6) ; `engagements` (`promesse`, 5) ; `limites` ; `visite` ; `suivre` | `follow_facebook`, `follow_channel` |
| **Questions fréquentes** `#questions` | `Questions` (`ferme.tsx`, `<details>` natifs) | `questions.groupes[4]` (`titre`, `questions[]` : `question`, `reponse`), réponses avec repères (`{coordonnees.whatsapp}`, `{prix.vivant}` ⚠, `{conditions.*}` ⚠) | — |
| **Votre demande** `#demande` (+ `#devis`, `#commande`, `#essai`) | `Demande` (`demande.tsx` : en-tête, onglets, 3 formulaires, vues de succès) | `demande` : `titre`, `chapeau` (`{delais.reponse}`, `{horaires.debut}`, `{horaires.fin}` ⚠), `etapes[]`, `boutonWhatsapp`, `boutonAppel`, `formulaires.{ceremonie,poulets,pro}` (`titre`, `texte`, `{delais.devis}` ⚠), `confidentialite` ; libellés, aides et messages d’erreur dans le code | `home_final`, `call` ; moteur : onglets, 2 étapes, validation, brouillon de visite, compteur, copie, « Modifier ma demande » ; **phase 4** : numéro WhatsApp, consentement, champ piège, envoi au serveur, référence, repli hors ligne, envoi sans JS |

## Après `<main>`

| Élément | Composant | Champs du back-office | `data-cta` et comportements |
| --- | --- | --- | --- |
| **Pied de page** `.footer`, `#nous-trouver`, `#mentions-legales`, `#confidentialite` | `PiedDePage` (`cadre.tsx`) | `pied.signature`, `pied.apropos`, `pied.horaires` ; `coordonnees.whatsapp`, `telephone` ⚠, `adresse`, `facebook`, `chaineWhatsapp`, `lienItineraire` ∅ ; mentions : `legal.editeur`, `legal.responsablePublication` ∅, `coordonnees.emailContact` ∅, `legal.hebergeur` ∅, `legal.propriete` ; `confidentialite.paragraphes[]` (réécrit en phase 4) ; © année (automatique, heure de Douala) | `footer_wa`, `call`, `footer_facebook`, `footer_channel` ; moteur : ouverture des `<details>` depuis l’ancre |
| **Barre fixe** `.bar` | `BarreFixe` (`cadre.tsx`) | `coordonnees.whatsapp`, `coordonnees.telephone` ⚠ | `sticky_generic`, `call` ; moteur : masquée tant qu’un bouton principal ou le formulaire est visible, et pendant la saisie |

## Hors page d’accueil

| Page | Composants | Champs |
| --- | --- | --- |
| `/demande/confirmation` (sans JS, `noindex`, phase 4) | `Confirmation` | mêmes textes que la vue de succès, référence, lien WhatsApp |
| `/go/{code}` (phase 6) | route | `campagne` |
| `sitemap.xml`, `robots.txt` | `app/sitemap.ts` (phase 7), `app/robots.ts` | domaine (variable d’environnement `SITE_URL`) |

## Libellés `data-cta` de la maquette (16)

`hero_wa`, `menu_wa`, `menu_facebook`, `menu_channel`, `home_video`, `cer_video`, `fetes_reserver`, `pay_video`, `follow_facebook`, `follow_channel`, `home_final`, `call` (3 emplacements), `footer_wa`, `footer_facebook`, `footer_channel`, `sticky_generic`.
Les boutons qui ouvrent un formulaire portent `data-demande` (ceremonie ×2, poulets ×3, pro ×1) ; 6 éléments portent `data-primary-cta` (masquent la barre fixe quand ils sont visibles). La mesure ajoutera des noms pour les boutons de la vue de succès (`form_wa`, `form_copie`) sans toucher aux existants. Tous sont présents à l’identique sur le site (contrôle de parité du DOM).
