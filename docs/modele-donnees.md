# Modèle de données proposé

MySQL 8 / MariaDB 10.6+, utf8mb4, dates en UTC (affichées à l’heure de Douala, UTC+1 sans heure d’été). Schéma Drizzle dans `lib/db/schema/`, migrations SQL versionnées dans `drizzle/`. Identifiants : `bigint` auto-incrémenté en interne ; jamais exposés au public (le public ne voit que la référence `HP-…`).

## 1. Contenu de la page

Le contenu publiable est **un document JSON** validé par un schéma Zod (`ContenuPage`). Il est stocké tel quel : publier et revenir en arrière deviennent des copies atomiques, et l’aperçu rend exactement ce qui sera publié.

| Table | Colonnes | Rôle |
| --- | --- | --- |
| `contenu_brouillon` | `id` (=1), `donnees` JSON, `a_confirmer` JSON (liste de chemins de champs), `revision` int, `modifie_le`, `modifie_par` (auteur lisible ; compte en phase 5) | le brouillon unique ; `revision` empêche d’écraser la saisie d’un autre (verrou optimiste) |
| `version_contenu` | `id`, `numero` int unique, `donnees` JSON, `a_confirmer` JSON, `empreinte` sha256 du JSON canonique, `publie_le`, `publie_par`, `restauree_depuis` (numéro), `note` | instantanés immuables, historique et retour arrière |
| `etat_publication` | `id` (=1), `version_en_ligne` → version, `modifie_le` | quelle version est en ligne |

### Structure du document `ContenuPage` (groupes du back-office)

| Groupe | Contenu (exemples) | Sensible (TOTP) |
| --- | --- | --- |
| `coordonnees` | `whatsapp` (`237693645565`), `telephone`, `emailContact`, `horaires`, `adresse`, `lienItineraire`, `facebook`, `chaineWhatsapp` | `whatsapp` |
| `delais` | `reponse` (« 30 minutes »), `plageReponse` (« de 7 h à 20 h »), `devis` (« 24 h ») | |
| `prix` | `vivant` 3000, `pretACuire` 3400, `decoupe` 3600 (FCFA, « à partir de ») ; `exempleDevisQuantite` 100 | |
| `conditions` | `acomptePourcent` 50, `soldeJoursAvant` 3, `minimumCeremonie` 20, `minimumHorsNde` 30, annulation (`seuilRemboursementJours` 10, `seuilConserveJours` 3, `avoirMois` 3), pro (`prixFixeSemaines` 4, `factureApresMois` 2, `factureJours` 7, `toleranceGrammes` 100, `revisionAlimentPourcent` 10, `preavisSemaines` 2) | |
| `paiement` | `mtn`, `orange`, `nomCompte` (vides au départ) | les trois |
| `fetes` | `actif`, `dateLimitePrixGaranti` 2026-11-01, `dateFin` 2026-12-20, `clotureNoel` 2026-12-15, `clotureNouvelAn` 2026-12-20, `creneauxLivraison`, textes du bandeau et du bloc | |
| `garanties` | 4 éléments (icône parmi le sprite + texte) | |
| `engagements` | promesse + 5 engagements (titre + texte) | |
| `sections.*` | textes de chaque section : sur-titre, titre, chapeau, paragraphes, listes (formules, étapes, limites, règles de paiement…) | |
| `listes.faq` | 4 groupes fixes (Commander, Payer et annuler, Livraison et cérémonies, Professionnels) × questions (question, réponse) | |
| `listes.zones` | nom, règle, ordre (6 au départ) | |
| `listes.avis` | prénom ou initiales, ville, texte, date, `accordEcrit` (date + moyen), publié | |
| `listes.photos` | `media` → `media.id`, texte alternatif (obligatoire), légende, ordre | |
| `promoteur` | nom, fonction, texte, photo + texte alternatif (vides au départ) | |
| `legal` | éditeur, responsable de la publication, hébergeur, propriété intellectuelle | |
| `seo` | titre, description, texte alternatif de l’image Open Graph | |

Les textes peuvent citer une valeur par un repère `{groupe.cle}` (ex. `{prix.pretACuire}`), mis en forme au rendu (`3 400 FCFA`, espaces insécables). Les règles de chaque champ (type, longueur, obligatoire, aide, exemple, sensible) sont décrites dans un **registre des champs** en code (`lib/contenu/champs.ts`), qui sert à la fois au formulaire du back-office, à la validation et aux contrôles de publication.

## 2. Réglages (hors publication)

| Table | Colonnes | Rôle |
| --- | --- | --- |
| `reglage` | `cle` PK, `valeur` JSON, `modifie_le`, `modifie_par` | e-mail de notification (sensible, TOTP), durée de conservation des demandes (12 mois), durée de conservation de la mesure (90 jours), seuils anti-spam |

## 3. Demandes

| Table | Colonnes | Remarques |
| --- | --- | --- |
| `demande` | `id`, `reference` unique (`HP-AAMMJJ-XXXXXX`), `type` (ceremonie, poulets, pro), `statut`, `nom`, `whatsapp_e164`, `reponses` JSON, `message` (texte envoyé, avec la référence), `consentement_contact_le`, `consentement_version`, `annonces` bool, `source_code`, `utm_source`, `utm_medium`, `utm_campaign`, `referent_domaine`, `mode_envoi` (js, sans_js), `statut_change_le`, `cree_le`, `maj_le` | index sur `statut`, `type`, `cree_le`, `whatsapp_e164`, `source_code` |
| `demande_evenement` | `id`, `demande_id`, `type` (creation, statut, note, contact_whatsapp, correction), `de_statut`, `vers_statut`, `texte`, `utilisateur_id`, `cree_le` | historique des statuts et notes internes |

Statuts : `nouvelle`, `contactee`, `devis_envoye`, `acompte_recu`, `en_preparation`, `livree`, `perdue`.
« À relancer » = statut hors `livree`/`perdue` et `statut_change_le` > 24 h.
Contenu de `reponses` selon le type (validé par Zod) :

- cérémonie : `ceremonie`, `date` ou `dateInconnue`, `lieu`, `invites`, `residence`, `precisions` ;
- poulets : `nombre`, `preparation`, `date`, `reception`, `lieu`, `precisions` ;
- pro : `etablissement`, `typeEtablissement`, `ville`, `volume`, `preparation`, `contact`, `precisions`.

Purge : suppression définitive (demande, événements, e-mails liés) quand `maj_le` dépasse la durée de conservation. Suppression à la demande d’un client : par numéro WhatsApp normalisé, toutes ses demandes.

## 4. Anti-spam

| Table | Colonnes | Remarques |
| --- | --- | --- |
| `limite_debit` | `cle` (ex. `ip:<empreinte>`, `tel:<empreinte>`, `auth:<empreinte>`), `fenetre_debut`, `compteur` ; PK (`cle`, `fenetre_debut`) | empreinte = HMAC-SHA-256(sel du jour, valeur), tronquée ; sel du jour dérivé du secret serveur, jamais stocké ; purge quotidienne |

## 5. E-mails

| Table | Colonnes |
| --- | --- |
| `email_sortant` | `id`, `type` (nouvelle_demande, alerte_securite, invitation, test), `destinataire`, `sujet`, `texte`, `html`, `demande_id` (suppression en cascade), `statut` (en_attente, envoye, echec), `tentatives`, `prochaine_tentative_le`, `derniere_erreur` (code SMTP, sans donnée personnelle), `cree_le`, `envoye_le` |

## 6. Comptes et sécurité (Better Auth, noms de tables en français)

| Table | Colonnes principales |
| --- | --- |
| `utilisateur` | `id`, `nom`, `email` unique, `email_verifie`, `role` (proprietaire, equipe), `actif`, `deux_facteurs_active`, `echecs_connexion`, `verrouille_jusqua`, `cree_le`, `maj_le` |
| `compte` | mot de passe haché (scrypt) et données du fournisseur « identifiants » |
| `session` | `id`, `jeton` unique, `utilisateur_id`, `expire_le`, `empreinte_ip`, `appareil` (ex. « Chrome · Android »), `cree_le`, `maj_le` |
| `deux_facteurs` | `utilisateur_id`, `secret` chiffré, `codes_secours` chiffrés (10, usage unique) |
| `verification` | jetons temporaires (réinitialisation de mot de passe, invitation) |
| `invitation` | `email`, `role`, `jeton_empreinte`, `expire_le`, `cree_par`, `acceptee_le` |

## 7. Médias

| Table | Colonnes | Remarques |
| --- | --- | --- |
| `media` | `id` (uuid), `cle` (nom de fichier aléatoire), `largeur`, `hauteur`, `variantes` JSON (`[{ largeur, fichier, octets }]`), `couleur_fond`, `cree_le`, `cree_par`, `masque_le` | fichiers WebP immuables dans `UPLOAD_DIR` ; suppression physique seulement quand aucune version ne les cite |

## 8. Campagnes et mesure

| Table | Colonnes | Remarques |
| --- | --- | --- |
| `campagne` | `id`, `code` unique (`[a-z0-9-]{2,32}`), `libelle`, `utm_source`, `utm_medium`, `utm_campaign`, `ancre`, `actif`, `cree_le`, `cree_par` | `/go/{code}` → `/?src={code}&utm_…#ancre` |
| `evenement` | `id`, `le`, `type` (vue, clic, formulaire, campagne), `cle` (valeur de `data-cta`, étape…), `formulaire`, `etape`, `source_code`, `utm_source`, `utm_medium`, `utm_campaign`, `referent_domaine`, `visite` (aléatoire, par onglet), `appareil` (mobile, tablette, ordinateur, d’après la largeur d’écran) | aucune IP, aucun agent, aucun cookie ; purge à 90 jours |
| `stat_jour` | `jour`, `mesure` (vues, clics, etapes, envois), `dimension` (source, cta, formulaire), `valeur`, `compteur` ; PK composite | agrégats conservés |

## 9. Journal d’audit

| Table | Colonnes | Remarques |
| --- | --- | --- |
| `journal_audit` | `id`, `le`, `utilisateur_id` (nul pour le système), `action` (ex. `contenu.modifier`, `contenu.publier`, `contenu.restaurer`, `demande.statut`, `demande.supprimer_client`, `connexion.reussie`, `connexion.echec`, `session.revoquer`, `reglage.modifier`, `media.ajouter`), `cible_type`, `cible_id`, `avant` JSON, `apres` JSON, `empreinte_ip` | valeurs sensibles masquées (`+237 6•• •• 55 65`) ; jamais de donnée personnelle d’un client en clair ; conservation 24 mois (réglable) |

## 10. Données initiales (automatiques au premier démarrage ; `npm run db:initialiser` en local)

- `contenu_brouillon` et la version n° 1 = contenu de la maquette, mot pour mot (avec les seules corrections typographiques permises). Badge « à confirmer » posé sur : prix « à partir de », frais/minimums/jours de livraison, conditions d’acompte et d’annulation, délais promis de réponse et de devis, téléphone.
- Champs vides (bloc masqué) : responsable de la publication, e-mail de contact, hébergeur, MTN, Orange, nom du compte, promoteur, photos, lien d’itinéraire, avis.
- Réglages par défaut ; aucun compte (créé ensuite par `npm run admin:creer`).
- Contrôle automatique : la page rendue avec la version n° 1 est comparée à la maquette (textes et captures, `npm run site:parite`).
- *Phase 3* : colonnes JSON relues aussi bien sur MySQL (objet) que sur MariaDB (texte) ; schéma Zod `lib/contenu/schema.ts`, migration `drizzle/0001_contenu.sql`.
