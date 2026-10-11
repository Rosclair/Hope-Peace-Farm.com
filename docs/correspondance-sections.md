# Correspondance : sections de la page → composants → champs du back-office

Ordre de la maquette. « Serveur » = composant serveur (aucun JavaScript envoyé) ; « client » = `"use client"`. Les chemins de champs renvoient au document `ContenuPage` (voir modele-donnees.md). ⚠ = importé avec le badge « à confirmer ». ∅ = vide au départ, bloc masqué tant qu’il est vide.

## Cadre de la page

| Élément (sélecteur, ancre) | Composant | Champs du back-office | `data-cta` et comportements |
| --- | --- | --- | --- |
| `<html data-wa data-fetes-deadline data-fetes-end>`, `<head>` (titre, description, Open Graph, canonique) | `app/(site)/layout.tsx`, `generateMetadata` (serveur) | `seo.titre`, `seo.description`, `seo.imageAlt`, `coordonnees.whatsapp`, `fetes.dateLimitePrixGaranti`, `fetes.dateFin` | script de tête repris à l’identique (`js`, `motion`, `scrolly`, `fetes-garanti`, `fetes-fin`) |
| JSON-LD `LocalBusiness` + `WebSite` | `JsonLd` (serveur) | `coordonnees.telephone` ⚠, `adresse`, `facebook`, `chaineWhatsapp`, `seo.description` ; zones desservies dérivées de `listes.zones` | — |
| Sprite SVG (logo 13 calques, 24 icônes) | `Sprite` (serveur) | — (code) | — |
| `.skip-link` « Aller au contenu » | dans le layout | — | — |
| `.banner` Bandeau des Fêtes | `BandeauFetes` (serveur) | `fetes.actif`, `fetes.texteBandeauGaranti` (avec `{fetes.dateLimitePrixGaranti}`), `fetes.texteBandeauApres`, `fetes.lienBandeau` | masqué par `fetes-fin` ; phrase de garantie par `fetes-garanti` |
| `.header` : marque, `.nav`, bouton « Commander », `details.menu` | `EnTete` (serveur) + `Menu` (client, `<details>` natif sans JS) | `coordonnees.whatsapp`, `facebook`, `chaineWhatsapp` ; libellés du menu dans le code (liés aux ancres) | `menu_wa`, `menu_facebook`, `menu_channel` ; `data-demande="poulets"` ; `inert` derrière le menu, Échap, fermeture au clic, section courante (`aria-current`) |
| `.header__progress` barre de lecture | dans `EnTete` | — | moteur : `--read`, `is-scrolled` |
| `.dock-logo` | `LogoVolant` (serveur) | — | moteur : logo qui se range dans l’en-tête |

## Sections de `<main id="contenu">`

| Section (ancre) | Composants | Champs du back-office | `data-cta` et comportements |
| --- | --- | --- | --- |
| **Accueil** `#accueil` `.hero` | `Accueil`, `Embleme` (calques du logo), `Paysage`, `CarteSuivi` (serveur) | `sections.accueil.surTitre`, `titre` (3 segments), `chapeau`, `boutonPrincipal`, `lienWhatsapp` ; `sections.accueil.suivi` : étiquette, titre, détail, 5 étapes (quoi, quand), pied | `hero_wa` ; `data-demande="ceremonie"`, `data-primary-cta` ; moteur : assemblage du logo, landing épinglée (`--dock`, `--out`, `--card`, `--s`, `--f`, `--foot`), indice « Faites défiler » |
| **Nos garanties** `.assurance` | `Garanties` (serveur) | `garanties.titre`, `garanties.elements[]` (icône, texte : « Devis écrit sous `{delais.devis}` » ⚠, « Acompte de `{conditions.acomptePourcent}` %, reçu écrit » ⚠) | apparitions décalées (`data-stagger`) |
| **Que préparez-vous ?** | `Portes` (serveur) | `sections.choix.titre`, 3 portes (titre, texte), prix de la porte « maison » = `{prix.pretACuire}` ⚠, phrase « Vous êtes à l’étranger ? » + lien | `home_video` |
| **Comment ça marche** | `Deroule` (serveur) | `sections.deroule.titre`, 4 étapes (acompte `{conditions.acomptePourcent}` ⚠) | `data-animate` : numéros et fil tracé |
| **Cérémonies** `#ceremonies`, `#formules`, `#exemple`, `#distance` | `Ceremonies`, `Formules` (cartes mobile), `TableauFormules` (ordinateur), `ExempleDevis`, `EncadreDistance` (serveur) | `sections.ceremonies` : sur-titre, titre, chapeau, bouton ; 3 formules (nom, pour qui, « plus », liste, délai conseillé) ; tableau comparatif (8 lignes × 3) ; conditions (acompte, solde `{conditions.soldeJoursAvant}`, minimum `{conditions.minimumCeremonie}`, hors Ndé `{conditions.minimumHorsNde}`) ⚠ ; « Comment nous travaillons » (5 étapes) ; exemple de devis **calculé** : `{prix.exempleDevisQuantite}` × `{prix.pretACuire}`, acompte, solde ⚠ ; encadré « à l’étranger » | `cer_video` ; `data-demande="ceremonie"` |
| **Poulets et Fêtes** `#poulets`, `#fetes` | `Poulets`, `BlocFetes`, `Preparations` (serveur) | `sections.poulets` : sur-titre, titre, chapeau, bouton ; `fetes` : titre, texte (créneaux `{fetes.creneauxLivraison}`, garantie `{fetes.dateLimitePrixGaranti}`), clôtures `{fetes.clotureNoel}`, `{fetes.clotureNouvelAn}` ; 3 préparations (nom, description, `{prix.vivant}`, `{prix.pretACuire}`, `{prix.decoupe}`) ⚠ ; calibres et poids ; phrase « prix final » | `fetes_reserver` (message WhatsApp avec garantie choisi selon la date, comme la maquette) ; `data-demande="poulets"` ; bloc masqué par `fetes-fin` |
| **Professionnels** `#professionnels` | `Professionnels` (serveur) | `sections.pro` : sur-titre, titre, chapeau (`{conditions.prixFixeSemaines}` ⚠), bouton, « Ce que nous garantissons » (4), essai | `data-demande="pro"` |
| **Livraison et paiement** `#livraison`, `#zones`, `#paiement`, `#payer` | `Livraison`, `SchemaZones` (SVG fixe, libellés dans le code), `ListeZones`, `ReglesPaiement`, `Annulation`, `EncadrePaiement` (serveur) | `listes.zones[]` (nom, règle) ⚠ ; note Douala/Yaoundé ; « Pourquoi des minimums ? » ; `sections.livraison.paiement[]` (5 règles) ⚠ ; annulation (3 paliers : `{conditions.seuilRemboursementJours}`, `{conditions.seuilConserveJours}`, `{conditions.avoirMois}`) ⚠ ; encadré « Payer en toute sécurité » + `paiement.mtn` ∅, `paiement.orange` ∅, `paiement.nomCompte` ∅ (phrase de remplacement prévue par la maquette quand ils sont remplis) ; numéro affiché = `coordonnees.whatsapp` | `pay_video` ; `data-animate` sur le schéma |
| **La ferme** `#la-ferme`, `#engagements` | `Ferme`, `Promoteur` ∅, `Galerie` ∅, `Avis` ∅ (nouveau bloc, voir risques), `Engagements`, `Limites`, `Visite`, `Suivre` (serveur) | `sections.ferme` : sur-titre, titre, texte ; `promoteur` (nom, fonction, texte, photo + alt) ∅ ; `listes.photos[]` ∅ ; `listes.avis[]` ∅ (publiés seulement avec accord écrit) ; `engagements` (promesse + 5) ; limites (3) ; visite ; suivre (titre, texte) | `follow_facebook`, `follow_channel` |
| **Questions fréquentes** `#questions` | `Questions` (serveur, `<details>` natifs) | `listes.faq` : 4 groupes fixes × questions (question, réponse) ; réponses avec repères (`{coordonnees.whatsapp}`, `{prix.vivant}` ⚠, `{conditions.*}` ⚠, `{delais.*}` ⚠) | — |
| **Votre demande** `#demande` (+ `#devis`, `#commande`, `#essai`) | `Demande` (serveur : titre, chapeau, étapes, boutons) + `Formulaires` (client : onglets, 3 formulaires, vue de succès) | `sections.demande` : titre, chapeau (`{delais.reponse}`, `{delais.plageReponse}` ⚠), 3 étapes, boutons ; introductions des 3 formulaires (titre + texte, `{delais.devis}` ⚠) ; texte court de confidentialité (réécrit, à valider) ; libellés, aides et messages d’erreur dans le code | `home_final`, `call` ; onglets, 2 étapes, validation, brouillon de visite, compteur, copie, « Modifier ma demande » ; **nouveau** : numéro WhatsApp, consentement, champ piège, envoi au serveur, référence, repli hors ligne, envoi sans JS |

## Après `<main>`

| Élément | Composant | Champs du back-office | `data-cta` et comportements |
| --- | --- | --- | --- |
| **Pied de page** `.footer`, `#nous-trouver`, `#mentions-legales`, `#confidentialite` | `PiedDePage`, `MentionsLegales`, `Confidentialite` (serveur) | marque : `pied.signature`, `pied.apropos` ; contact : `coordonnees.whatsapp`, `telephone` ⚠, `horaires`, `adresse`, `facebook`, `chaineWhatsapp`, `lienItineraire` ∅ ; mentions : `legal.editeur`, `legal.responsablePublication` ∅, `coordonnees.emailContact` ∅, `legal.hebergeur` ∅, `legal.propriete` ; confidentialité : texte réécrit (à valider) ; © année (automatique, heure de Douala) | `footer_wa`, `call`, `footer_facebook`, `footer_channel` ; ouverture des `<details>` depuis l’ancre |
| **Barre fixe** `.bar` | `BarreFixe` (serveur ; affichage piloté par le moteur) | `coordonnees.whatsapp`, `coordonnees.telephone` ⚠ | `sticky_generic`, `call` ; masquée tant qu’un bouton principal ou le formulaire est visible, et pendant la saisie |

## Hors page d’accueil

| Page | Composants | Champs |
| --- | --- | --- |
| `/demande/confirmation` (sans JS, `noindex`) | `Confirmation` (serveur) | mêmes textes que la vue de succès, référence, lien WhatsApp |
| `/go/{code}` | route | `campagne` |
| `sitemap.xml`, `robots.txt` | `app/sitemap.ts`, `app/robots.ts` | domaine (variable d’environnement `SITE_URL`) |

## Libellés `data-cta` de la maquette (16)

`hero_wa`, `menu_wa`, `menu_facebook`, `menu_channel`, `home_video`, `cer_video`, `fetes_reserver`, `pay_video`, `follow_facebook`, `follow_channel`, `home_final`, `call` (3 emplacements), `footer_wa`, `footer_facebook`, `footer_channel`, `sticky_generic`.
Les boutons qui ouvrent un formulaire portent `data-demande` (ceremonie ×2, poulets ×3, pro ×1) ; 6 éléments portent `data-primary-cta` (masquent la barre fixe quand ils sont visibles). La mesure ajoutera des noms pour les boutons de la vue de succès (`form_wa`, `form_copie`) sans toucher aux existants.
