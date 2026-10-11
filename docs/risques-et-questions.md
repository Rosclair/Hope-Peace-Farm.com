# Risques, manques et questions (phase 0)

## 1. Risques

| # | Risque | Gravité | Ce que je propose |
| --- | --- | --- | --- |
| R1 | **Domaine** : `hopeandpeacefarm.com` n’est pas enregistré à ce jour (aucune entrée au registre Verisign ni dans le DNS, vérifié le 11/10/2026). | Élevée | L’enregistrer (chez Hostinger, pour simplifier DNS, e-mail et certificat). En attendant, phase 1 sur le sous-domaine temporaire fourni par Hostinger. La boîte e-mail du domaine en dépend. |
| R2 | **Hostinger, points non documentés** : persistance d’un dossier hors déploiement (`UPLOAD_DIR`), tâches cron pour les applications Node.js, `NODE_ENV` à l’exécution, module natif sharp, cache intermédiaire devant l’application, en-tête portant l’IP du visiteur. *Mise à jour phase 1* : la documentation confirme que Hostinger impose la sortie `standalone`, réécrit `hbuilds/` et `public_html/` à chaque déploiement (seule la version en ligne est gardée) et **arrête le processus après une période sans trafic** (un minuteur interne ne peut donc pas servir de cron). | Élevée | Tout est contrôlé sur le serveur par le diagnostic `/api/sante` et `scripts/verifier-deploiement.mjs` ([deploiement-hostinger.md](deploiement-hostinger.md)). Plans B prêts : photos en base, cron depuis un autre site du compte, `NODE_ENV` forcé, en-têtes de cache explicites (architecture.md §16). |
| R3 | **Loi n° 2024/017** (en vigueur depuis le 23 juin 2026) : selon des commentaires juridiques, l’hébergement à l’étranger de données de Camerounais exige un niveau de protection équivalent et une autorisation préalable de l’autorité (APDP). Hostinger n’a pas de centre de données au Cameroun. Je ne suis pas juriste : à vérifier. | Élevée (juridique) | Minimiser : pas d’IP, pas de suivi, conservation 12 mois, suppression sur demande, texte de confidentialité qui mentionne l’hébergement à l’étranger. La démarche éventuelle auprès de l’APDP vous revient. |
| R4 | **Performance mobile ≥ 95** : la maquette elle-même obtient **87** sur Lighthouse mobile (ce poste), à cause du temps de blocage (≈ 520 ms) : calcul du style et de la mise en page de toute la page en une tâche, pas le script (71 ms). Deux pistes mesurées sur des copies : polices de repli sans recherche `local()` des polices système (→ 92, mais à arbitrer avec le risque de décalage au chargement, puisque ces polices ajustées évitent le saut de texte) et `content-visibility` sur les sections hors écran (les deux → 94). React et Next.js ajouteront ensuite leur socle JS (de l’ordre de 100 Ko compressés, estimation à mesurer en phase 2) et le temps d’hydratation. *Mesure phase 1* : le squelette Next.js **sans aucun composant client** charge déjà 5 fichiers JS (458 Ko décompressés, ~116 Ko en brotli) ; sur mobile simulé, 317 ms d’évaluation de script et 68 ms de compilation, TBT 156–171 ms, performance 98. Le portage ajoutera le coût de mise en page de la maquette (TBT ≈ 520 ms) à ce socle. | **Élevée** | Appliquer les deux corrections au portage, composants serveur partout, quatre composants clients seulement, moteur sans React. Mesure à chaque phase, puis PageSpeed Insights une fois en ligne (serveurs Linux, chiffres différents de ce poste Windows). Si 95 reste hors d’atteinte, la cause mesurée sera consignée, comme le brief le prévoit. |
| R5 | **CSP et page en cache** : une CSP à nonce impose un rendu par requête, incompatible avec le cache demandé. | Moyenne | CSP à empreintes (script de tête) ; si les scripts en ligne d’hydratation de Next ne peuvent pas être couverts, compromis documenté en phase 7. |
| R6 | **Parité visuelle** : la maquette intègre ses polices en base64 (aucun texte en police de repli) ; le site les chargera en fichiers (préchargés). Le moteur s’exécute après l’hydratation au lieu de la fin du `<body>`. | Moyenne | Polices préchargées et métriques de repli reprises de la maquette ; captures au même instant des deux côtés ; écarts restants justifiés. |
| R7 | **Écarts voulus avec la maquette** : formulaires utilisables sans JS (la maquette affiche « Le formulaire a besoin de JavaScript ») ; bandeau des Fêtes correct sans JS ; nouveaux champs (numéro, consentement) ; nouveau texte de confidentialité ; bloc « Avis » absent de la maquette. | Faible | Je les liste comme écarts justifiés. Le bloc « Avis » réutilisera les styles existants (cartes des engagements), placé dans « La ferme », masqué tant qu’il n’y a aucun avis avec accord écrit ; à valider sur capture en phase 6. |
| R8 | **Délai minimal anti-spam sans JS** : la page étant en cache, le serveur ne peut pas dater l’affichage du formulaire. | Faible | Délai mesuré par le script ; sans JS, champ piège et limites de débit seulement. |
| R9 | **Image Open Graph** : la maquette cite `assets/img/og-default.png`, qui n’existe pas. | Faible | La générer à partir du logo et des couleurs (aucune photo de banque d’images). |
| R10 | **Contenus « à confirmer » publiés** : la première publication doit égaler la maquette, donc avec des prix et conditions non confirmés. | Faible | Avertissement à la publication (non bloquant) et compteur au tableau de bord. |
| R11 | **Navigateurs anciens** : Safari iOS 15.0–15.3 n’a ni `:has()` ni `svh` ; `inert` arrive en 15.5. | Faible | Replis déjà présents dans la maquette ; sans `:has()`, les trois formulaires sans JS s’empilent. |
| R12 | **Réseau de ce poste très lent** : 6 à 40 Ko/s en phase 1, coupures `ECONNRESET` (une installation npm a échoué après 70 min). | Moyenne (délai) | Grosses archives téléchargées par morceaux (`curl -r`, 16 connexions), vérifiées par SHA-512 puis versées au cache npm ; installations en `--prefer-offline`. Next.js 16.4 et toutes les dépendances de la phase 1 sont maintenant en cache. |
| R13 | **Délivrabilité des e-mails** : sans SPF, DKIM et DMARC sur le domaine, les notifications risquent le dossier « indésirables ». | Moyenne | Configuration DNS en phase 1, e-mail de test vers la boîte du propriétaire. |
| R14 | **Élément LCP** : le brief vise le titre ; dans la maquette, l’élément LCP mobile est le chapeau `p.hero__lead` (du texte aussi), car les trois lignes du titre sont des `<span>` en `display: block`, comptées séparément. | Faible | Garder la maquette telle quelle (le LCP reste du texte, à 1,4 s) ; je le signale plutôt que de modifier le titre. |
| R15 | **Horloges de la base et de Node** : MySQL avance de ~15 ms sur Node sur ce poste ; chez Hostinger, la base peut être sur une autre machine. Une comparaison mêlant les deux horloges a fait échouer un envoi immédiat d’e-mail (trouvé en phase 1). | Faible (corrigé) | La file d’envoi n’utilise plus que l’horloge de la base (`CURRENT_TIMESTAMP`). Règle pour la suite : une date comparée en SQL vient de la base. |
| R16 | **Cache HTML d’un an** : Next envoie `Cache-Control: s-maxage=31536000` sur la page statique. Un cache ou CDN devant l’application qui respecte `s-maxage` garderait l’ancienne page après « Publier ». | Moyenne | Le vérificateur relève les indices de cache intermédiaire sur Hostinger ; en-tête du HTML fixé en phase 3 (architecture §4). |

## 2. Données qui me manquent

À fournir maintenant (phase 1) :

- l’adresse qui reçoit les notifications de demandes ;
- l’e-mail du premier compte Propriétaire (et, plus tard, ceux de l’Équipe).

À saisir plus tard dans le back-office (le bloc reste masqué en attendant) :

- responsable de la publication, e-mail de contact, hébergeur (raison sociale et adresse) ;
- numéros MTN et Orange Money et nom du compte ;
- promoteur (nom, fonction, photo avec son accord) ;
- photos de la ferme (vraies photos) ;
- lien d’itinéraire Google Maps ;
- avis clients avec accord écrit ;
- confirmation des valeurs « à confirmer » : téléphone, prix, frais, minimums et jours de livraison, acompte et annulation, délais de réponse et de devis.

À valider : le texte de confidentialité réécrit (rédigé en phase 4).

## 3. Accès qui me manquent

- **Hostinger** : hPanel (création de l’application Node.js, base MySQL, boîte e-mail, DNS) ou exécution des étapes par vous, selon votre réponse à la question 1.
- **GitHub** : un dépôt (privé) relié à Hostinger, avec droit d’écriture pour pousser.
- **Base MySQL** : nom, utilisateur, mot de passe, hôte (à mettre dans `.env`, jamais dans le dépôt).
- **SMTP** : boîte du domaine (hôte, port, utilisateur, mot de passe).

## 4. Décisions prises par défaut (option la plus prudente)

- **Tous les textes de la page** sont modifiables dans le back-office (mission n° 3 : « tout le contenu de la page »), sauf libellés et messages des formulaires, messages WhatsApp pré-remplis, ancres et libellés du menu, qui restent dans le code parce que la mesure, les tests et les comportements en dépendent.
- **Fêtes** : bandeau et bloc masqués à partir du 21 décembre 2026 à 0 h (heure de Douala), phrase de garantie masquée à partir du 1er novembre 2026 à 0 h, comme le calcul de la maquette.
- **Node 24** (version installée sur ce poste, proposée par Hostinger) ; Node 22 si l’essai échoue.
- **Mot de passe** : scrypt (défaut de Better Auth, sans module natif) plutôt qu’argon2id (module natif à compiler chez Hostinger).
- **Photos** : `UPLOAD_DIR` si la persistance est confirmée en phase 1, sinon stockage en base.
- **© année** du pied de page calculée automatiquement (2026 aujourd’hui, comme la maquette).
- **Phase 1, sans réponse à la question 1** : aucun dépôt distant créé, rien envoyé sur un compte ; squelette vérifié en local et guide de déploiement pas à pas ([deploiement-hostinger.md](deploiement-hostinger.md)) que vous pouvez suivre sans me transmettre de mot de passe.
- **Phase 1, sans domaine** : déploiement possible sur l’adresse temporaire de Hostinger ; l’essai SMTP réel attend la boîte du domaine.

## 5. Questions (3)

1. **Accès Hostinger et GitHub** : me donnez-vous les accès pour que je déploie moi-même en phase 1, ou préférez-vous exécuter les étapes vous-même avec mes instructions ?
2. **Domaine** : `hopeandpeacefarm.com` n’est pas enregistré. Le réservez-vous (de préférence chez Hostinger), ou faut-il un autre nom ?
3. **Hébergement hors du Cameroun** : on continue avec Hostinger (centre de données en Europe), en vous chargeant de vérifier la démarche APDP, ou voulez-vous d’abord un avis juridique ?
