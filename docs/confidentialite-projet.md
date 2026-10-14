# Texte de confidentialité — projet à valider

État : rédigé en phase 4 (14/10/2026), **en ligne en attendant votre validation**, car l’ancien texte de la maquette (« Rien n’est enregistré sur ce site ») est devenu faux dès que les demandes sont enregistrées. Vous pourrez le modifier dans le back-office (phase 5) ; d’ici là : `npm run contenu -- exporter f.json`, modifier, `npm run contenu -- importer f.json`, `npm run contenu -- publier`.

## 1. Sous les formulaires (une phrase, suivie du lien « Confidentialité »)

> Votre demande est enregistrée pour que nous puissions vous répondre sur WhatsApp, puis effacée au bout de 12 mois. Elle n’est jamais vendue.

## 2. Bloc « Confidentialité » (pied de page)

> Quand vous envoyez un formulaire, nous enregistrons votre demande : vos réponses, votre nom, votre numéro WhatsApp, la date de votre accord pour être contacté et, si vous l’avez cochée, votre inscription à nos annonces. Nous notons aussi d’où vient votre visite (lien d’une campagne, site d’origine), jamais votre adresse IP.
>
> Ces informations servent uniquement à préparer votre devis ou votre commande, à vous répondre sur WhatsApp et à organiser la livraison. Une copie de votre demande nous parvient par e-mail. Elles ne sont jamais vendues ; elles sont transmises seulement à la personne qui livre votre commande. La conversation elle-même passe par WhatsApp, selon ses propres règles.
>
> Votre demande est effacée 12 mois après sa dernière mise à jour. Les annonces s’arrêtent dès que vous nous le demandez.
>
> Vous pouvez consulter, corriger ou faire supprimer vos informations, et retirer votre accord, en écrivant au +237 6 93 64 55 65. Indiquez si possible la référence de votre demande (HP-…).
>
> Aucun cookie, aucun traceur publicitaire. Votre saisie est gardée dans votre navigateur le temps de la visite, pour ne rien perdre si vous parcourez la page.
>
> Référence : loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel.

## 3. Case obligatoire du formulaire

> J’accepte d’être contacté sur WhatsApp au sujet de ma demande.

Le texte exact et sa version (`2026-10-14`) sont enregistrés avec chaque demande, avec la date de l’accord. Changer ce texte demande de changer la version (`lib/demandes/schema.ts`).

## 4. Ce que le texte affirme, et ce qui le garantit

| Affirmation | Garantie dans le code |
| --- | --- |
| Données enregistrées : réponses, nom, numéro, date de l’accord, annonces, source de la visite | table `demande` (docs/modele-donnees.md §3) ; rien d’autre |
| Jamais l’adresse IP | limites de débit sur une empreinte HMAC à sel quotidien, jamais l’adresse ; aucune colonne d’IP |
| Copie par e-mail | e-mail « nouvelle demande » à l’adresse `NOTIFICATION_EMAIL` |
| Effacée 12 mois après la dernière mise à jour | tâche quotidienne `purge-demandes` (`DEMANDES_CONSERVATION_MOIS`, 12 par défaut), e-mails et historique compris |
| Droits d’accès, de correction, de suppression | fiche de la demande et « Supprimer les données de ce client » au back-office (phase 5) ; d’ici là, sur demande, en base |
| Aucun cookie, aucun traceur | aucun cookie posé par la page publique ; mesure maison sans identifiant persistant (phase 6) |

## 5. Points à trancher par vous

1. **Durée de conservation** : 12 mois (brief). Si vous la changez (`DEMANDES_CONSERVATION_MOIS`), changez aussi « 12 mois » dans les deux textes.
2. **Hébergement hors du Cameroun** (question 3 de [risques-et-questions.md §5](risques-et-questions.md#5-questions-3)) : la loi n° 2024/017 encadre les transferts de données hors du pays. Le texte n’en parle pas encore ; à compléter selon votre réponse (par exemple : « Le site est hébergé chez Hostinger, dans un centre de données en Europe. »).
3. **Responsable du traitement** : le bloc « Mentions légales » n’affiche pas encore de responsable ni d’e-mail de contact (champs vides, masqués). La loi demande que la personne puisse identifier le responsable : à renseigner.
4. **Livreur** : « transmises seulement à la personne qui livre votre commande » reprend la maquette. À garder si c’est bien la pratique.
