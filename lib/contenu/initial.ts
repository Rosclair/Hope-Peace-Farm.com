// Contenu initial de la page : celui de la maquette, mot pour mot
// (reference/hope-and-peace-farm-apercu-2.html). À la première publication
// (phase 3), la page rendue avec ce contenu est identique à la maquette ;
// le contrôle de parité (npm run site:parite) le vérifie.
//
// Dans ce fichier, « ~ » note une espace insécable (U+00A0) : la maquette en
// met partout où elle écrit &nbsp;. Les repères {groupe.cle} sont remplacés au
// rendu par les valeurs mises en forme (voir reperes.ts).

import type { ContenuPage } from "./types";

/** Remplace « ~ » par une espace insécable dans toutes les chaînes d’un objet. */
function insecables<T>(valeur: T): T {
  if (typeof valeur === "string") return valeur.replaceAll("~", " ") as T;
  if (Array.isArray(valeur)) return valeur.map(insecables) as T;
  if (valeur && typeof valeur === "object") {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, insecables(v)])) as T;
  }
  return valeur;
}

export const CONTENU_INITIAL: ContenuPage = insecables<ContenuPage>({
  seo: {
    titre: "Poulets de ferme à Bangangté | Hope & Peace Farm",
    // Attributs de la maquette : espaces simples (pas d’entités).
    description:
      "Poulets élevés à Bangangté, vivants, prêts à cuire ou découpés. Cérémonies, fêtes, professionnels : devis écrit sous 24 h, livraison dans l’Ouest.",
    descriptionEntreprise:
      "Hope & Peace Farm élève des poulets de chair et des chèvres à Bangangté, dans le Ndé. Vente directe aux familles, aux organisateurs de cérémonies et aux professionnels de l’Ouest, commandes de Douala, de Yaoundé et de l’étranger pour une livraison dans l’Ouest.",
    zonesDesservies: ["Bangangté", "Ndé", "Bafoussam", "Ouest", "Douala", "Yaoundé"],
  },
  coordonnees: {
    whatsapp: "237693645565",
    telephone: "+237693645565",
    emailContact: "",
    adresse: "Bangangté, Ndé, région de l’Ouest, Cameroun",
    lienItineraire: "",
    facebook: "https://www.facebook.com/share/19txTSFrCX/",
    chaineWhatsapp: "https://whatsapp.com/channel/0029Vb8zdD9Au3aZ2Jubpu1U",
  },
  horaires: { debut: "7~h", fin: "20~h" },
  delais: { reponse: "30~minutes", devis: "24~h" },
  prix: { vivant: 3000, pretACuire: 3400, decoupe: 3600 },
  conditions: {
    acomptePourcent: 50,
    soldeJoursAvant: 3,
    minimumCeremonie: 20,
    minimumHorsNde: 30,
    seuilRemboursementJours: 10,
    seuilConserveJours: 3,
    avoirMois: 3,
    prixFixeSemaines: 4,
    factureApresMois: 2,
    factureJours: 7,
    toleranceGrammes: 100,
    revisionAlimentPourcent: 10,
    preavisSemaines: 2,
  },
  paiement: { mtn: "", orange: "", nomCompte: "" },
  fetes: {
    actif: true,
    dateLimitePrixGaranti: "2026-11-01",
    dateFin: "2026-12-20",
    clotureNoel: "2026-12-15",
    clotureNouvelAn: "2026-12-20",
    garantie: "Prix garanti pour toute réservation avant le {fetes.dateLimitePrixGaranti}.",
    bandeau: { annonce: "Réservations des fêtes ouvertes.", lien: "Réserver mes poulets de fête" },
    bloc: {
      titre: "Les réservations des fêtes sont ouvertes.",
      texteAvant:
        "Cette année, pas de course au marché le 24~décembre. Réservez dès maintenant vos poulets de ferme élevés à Bangangté~: vivants, prêts à cuire ou découpés.",
      texteApres:
        "Retrait à la ferme ou livraison du 22 au 24 et du 29 au 31~décembre. Photo de votre commande avant la livraison. Acompte de {conditions.acomptePourcent}~%, solde au retrait ou à la livraison.",
      libelleClotureNoel: "Clôture Noël",
      libelleClotureNouvelAn: "Clôture Nouvel An",
      bouton: "Réserver sur WhatsApp",
    },
  },
  accueil: {
    surTitre: "Poulets de ferme à Bangangté",
    titre: ["Vous êtes loin.", "La cérémonie est au village.", "Vos poulets seront là."],
    chapeau: "Nous élevons, préparons et livrons vos poulets sur le lieu de la cérémonie, la veille ou le jour~J.",
    boutonPrincipal: "Préparer ma cérémonie",
    lienWhatsapp: "Parler à la ferme",
    suivi: {
      etiquette: "Exemple de suivi",
      titre: "Funérailles à Bazou",
      detail: "120 poulets prêts à cuire, livrés le 23~décembre",
      etapes: [
        { quoi: "Devis écrit envoyé sur WhatsApp", quand: "J-21" },
        { quoi: "Acompte de {conditions.acomptePourcent}~%, reçu écrit", quand: "J-20" },
        { quoi: "Photos des poulets à la ferme", quand: "J-7" },
        { quoi: "Préparation et comptage, en photo", quand: "J-1" },
        { quoi: "Livrés sur le lieu de la cérémonie", quand: "Jour J" },
      ],
      pied: "Le bon compte. Le bon jour. La preuve.",
    },
  },
  garanties: {
    titre: "Nos garanties",
    elements: [
      { icone: "i-farm", texte: "Une vraie ferme à Bangangté" },
      { icone: "i-doc", texte: "Devis écrit sous {delais.devis}" },
      { icone: "i-camera", texte: "Photos à chaque étape" },
      { icone: "i-receipt", texte: "Acompte de {conditions.acomptePourcent}~%, reçu écrit" },
    ],
  },
  choix: {
    titre: "Que préparez-vous~?",
    portes: {
      ceremonie: {
        titre: "Pour une cérémonie",
        texte: "Funérailles, mariages, dots~: nous livrons au village, la veille ou le jour~J.",
        prix: "",
      },
      maison: {
        titre: "Pour la maison",
        texte: "Des poulets prêts à cuire pour les fêtes et les dimanches.",
        prix: "À partir de {prix.pretACuire}",
      },
      pro: {
        titre: "Pour les professionnels",
        texte: "Le même calibre, le même jour, chaque semaine.",
        prix: "",
      },
    },
    etranger: { question: "Vous êtes à l’étranger~?", lien: "Appel vidéo depuis la ferme" },
  },
  deroule: {
    titre: "Comment ça marche",
    etapes: [
      "Dites-nous votre besoin~: quantité, préparation, date, lieu.",
      "Recevez votre devis écrit.",
      "Réservez avec un acompte de {conditions.acomptePourcent}~%.",
      "Recevez votre commande, photos à l’appui.",
    ],
  },
  ceremonies: {
    surTitre: "Cérémonies",
    titre: "Votre cérémonie au village, l’esprit en paix.",
    chapeau:
      "Funérailles, mariage, dot, baptême, retour au village~: vous avez mille choses à organiser, souvent de loin. Confiez-nous les poulets, et plus si vous le souhaitez. Nous élevons, préparons et livrons sur le lieu de la cérémonie, avec des photos à chaque étape.",
    bouton: "Demander mon devis cérémonie",
    formules: {
      titre: "Trois formules",
      liste: [
        {
          nom: "Essentiel",
          pourQui: "Vous avez quelqu’un sur place pour cuisiner.",
          plus: "",
          elements: [
            "Poulets vivants ou prêts à cuire",
            "Livraison la veille, sur le lieu de la cérémonie",
            "Photo à la livraison",
            "Chèvres en option",
          ],
          delai: "Délai conseillé~: 2~semaines",
        },
        {
          nom: "Sérénité",
          pourQui: "Vous êtes loin et voulez être tranquille.",
          plus: "Tout l’Essentiel, plus~:",
          elements: [
            "Poulets prêts à cuire, découpés ou abattus sur place",
            "Livraison la veille ou le jour~J, créneau garanti",
            "Photos et vidéo~: préparation, comptage, livraison",
            "Chèvres préparées sur devis",
            "Un coordinateur joignable du devis au jour~J",
          ],
          delai: "Délai conseillé~: 3~semaines",
        },
        {
          nom: "Clé en main",
          pourQui: "Vous voulez un seul interlocuteur pour tout.",
          plus: "Toute la Sérénité, plus~:",
          elements: [
            "Autres produits (plantain, macabo, légumes, piment, œufs…) recherchés auprès de fournisseurs vérifiés, sur devis",
            "Un point quotidien avec le coordinateur la dernière semaine",
            "Un récapitulatif final",
          ],
          delai: "Délai conseillé~: 4~semaines (8 pour une grosse quantité)",
        },
      ],
      tableau: [
        {
          critere: "Pour qui",
          valeurs: [
            "Vous avez quelqu’un sur place pour cuisiner",
            "Vous êtes loin et voulez être tranquille",
            "Vous voulez un seul interlocuteur pour tout",
          ],
        },
        {
          critere: "Poulets",
          valeurs: ["Vivants ou prêts à cuire", "Prêts à cuire, découpés ou abattus sur place", "Comme Sérénité"],
        },
        {
          critere: "Livraison",
          valeurs: ["La veille, sur le lieu de la cérémonie", "La veille ou le jour~J, créneau garanti", "Comme Sérénité"],
        },
        {
          critere: "Preuves",
          valeurs: [
            "Photo à la livraison",
            "Photos et vidéo~: préparation, comptage, livraison",
            "Comme Sérénité, plus un récapitulatif final",
          ],
        },
        { critere: "Chèvres", valeurs: ["En option", "En option, préparées sur devis", "Selon le devis"] },
        {
          critere: "Autres produits",
          valeurs: ["", "", "Plantain, macabo, légumes, piment, œufs… recherchés auprès de fournisseurs vérifiés, sur devis"],
        },
        {
          critere: "Coordinateur",
          valeurs: ["", "Joignable du devis au jour~J", "Joignable, avec un point quotidien la dernière semaine"],
        },
        { critere: "Délai conseillé", valeurs: ["2~semaines", "3~semaines", "4~semaines (8 pour une grosse quantité)"] },
      ],
      conditions: [
        "Acompte de {conditions.acomptePourcent}~% à la réservation~; solde au plus tard {conditions.soldeJoursAvant}~jours avant la livraison. Minimum~: {conditions.minimumCeremonie}~poulets. Nous vous aidons à calculer la quantité à partir du nombre d’invités et du menu.",
        "Hors du Ndé et de Bafoussam~: minimum {conditions.minimumHorsNde}~poulets.",
      ],
    },
    methode: {
      titre: "Comment nous travaillons",
      etapes: [
        "Vous nous donnez la date, le lieu, le nombre d’invités et le menu.",
        "Nous calculons la quantité et vous envoyons un devis écrit sous {delais.devis}.",
        "Vous réservez avec un acompte de {conditions.acomptePourcent}~%.",
        "Nous vous envoyons des photos~: les poulets à la ferme, la préparation, le comptage, la livraison.",
        "Votre contact sur place confirme la réception.",
      ],
    },
    exemple: {
      titre: "Exemple de devis",
      quantite: 100,
      libelle: "Poulets prêts à cuire",
      total: "Total produits (hors livraison)",
      acompte: "Acompte de {conditions.acomptePourcent}~%",
      solde: "Solde",
      note: "Livraison et coordination~: selon la zone et la formule, écrites sur votre devis.",
      mention: "Exemple de calcul à partir de nos prix actuels. Votre devis est écrit sur mesure.",
    },
    distance: {
      titre: "Vous êtes à l’étranger~?",
      texte:
        "Nous pouvons faire un appel vidéo depuis la ferme avant votre réservation. Paiement par Mobile Money, directement ou par un proche.",
      bouton: "Demander un appel vidéo",
      lien: "Comment payer en sécurité",
    },
  },
  poulets: {
    surTitre: "Poulets et Fêtes",
    titre: "Vos poulets de ferme, préparés comme vous voulez, livrés le jour convenu.",
    chapeau: "Élevés à Bangangté. Vivants, prêts à cuire ou découpés. Pour vos repas de famille.",
    bouton: "Commander mes poulets",
    preparations: {
      titre: "Nos préparations",
      liste: [
        { nom: "Vivant", description: "tel qu’il sort de la ferme", prix: "{prix.vivant}" },
        { nom: "Prêt à cuire", description: "tué, plumé, vidé, nettoyé", prix: "{prix.pretACuire}" },
        { nom: "Découpé", description: "prêt à cuire, découpé sauce ou braise", prix: "{prix.decoupe}" },
      ],
      calibres: {
        titre: "Calibres et poids.",
        texte:
          "Calibre standard~: environ 1,8 à 2,1~kg vivant. Calibre gros~: 2,2~kg et plus. Un poulet prêt à cuire pèse environ les trois quarts de son poids vivant.",
      },
      prixFinal:
        "Le prix final est écrit sur votre devis. Aucun supplément surprise. Les options (calibre, préparation, découpe, livraison) y figurent une par une.",
    },
  },
  pro: {
    surTitre: "Professionnels",
    titre: "Le même calibre, le même jour, chaque semaine.",
    chapeau:
      "Restaurants, snacks, braiseurs, hôtels, traiteurs~: recevez vos poulets de ferme à jour fixe, au calibre convenu, au prix fixé pour {conditions.prixFixeSemaines}~semaines. Vous payez à la livraison. Moins de temps au marché, plus de temps en cuisine.",
    bouton: "Demander une livraison d’essai",
    garanties: {
      titre: "Ce que nous garantissons",
      elements: [
        "un calibre régulier",
        "une livraison tôt le matin",
        "un prix stable sur le mois",
        "un interlocuteur joignable",
      ],
    },
    essai: { titre: "Essai.", texte: "Une première livraison d’essai, avec un poulet offert. Sans engagement." },
  },
  livraison: {
    surTitre: "Livraison et paiement",
    titre: "Où et quand nous livrons",
    zones: [
      { nom: "Retrait à la ferme (Bangangté)", regle: "gratuit, sur rendez-vous." },
      { nom: "Bangangté ville", regle: "500 à 1~000~FCFA, offert dès 10~poulets." },
      { nom: "Département du Ndé", regle: "selon la distance, dès 5~poulets." },
      { nom: "Bafoussam et axes proches", regle: "jours de tournée fixes." },
      { nom: "Reste de l’Ouest", regle: "cérémonies, sur devis." },
      { nom: "Douala et Yaoundé", regle: "tournées groupées aux dates annoncées, à partir de 20~poulets par point." },
    ],
    note: "Pas de livraison à domicile à Douala ou Yaoundé en dehors d’une tournée annoncée. Vous commandez depuis Douala ou Yaoundé pour une cérémonie dans l’Ouest~? C’est la [formule Cérémonie](#ceremonies).",
    minimums: {
      titre: "Pourquoi des minimums~?",
      texte:
        "Pour vous livrer à l’heure et au juste prix, nous regroupons les livraisons. C’est aussi ce qui nous permet de garder des prix raisonnables.",
    },
    paiement: {
      titre: "Paiement",
      regles: [
        { cas: "Retrait à la ferme, petite commande", regle: "Paiement au retrait (Mobile Money ou espèces), reçu remis" },
        { cas: "Livraison locale, moins de 10~poulets", regle: "Paiement à la livraison ou avant, au choix" },
        {
          cas: "Cérémonie, commande à distance, 10~poulets et plus",
          regle:
            "Acompte de {conditions.acomptePourcent}~% à la réservation~; solde au plus tard {conditions.soldeJoursAvant}~jours avant la livraison",
        },
        {
          cas: "Réservation Fêtes",
          regle:
            "Acompte de {conditions.acomptePourcent}~% pour garantir le prix et la quantité~; solde au retrait ou à la livraison (avant la livraison pour les clients à distance)",
        },
        {
          cas: "Professionnels",
          regle:
            "Paiement à la livraison~; après {conditions.factureApresMois}~mois sans incident, facture à {conditions.factureJours}~jours au maximum",
        },
      ],
    },
    annulation: {
      titre: "Annulation",
      paliers: [
        { quand: "Plus de {conditions.seuilRemboursementJours}~jours avant", quoi: "Acompte remboursé ou reporté." },
        {
          quand: "Entre {conditions.seuilRemboursementJours} et {conditions.seuilConserveJours}~jours",
          quoi: "Acompte reporté (avoir valable {conditions.avoirMois}~mois).",
        },
        {
          quand: "Moins de {conditions.seuilConserveJours}~jours",
          quoi: "Acompte conservé, car la préparation est engagée.",
        },
      ],
    },
    securite: {
      titre: "Payer en toute sécurité",
      moyens: "Par MTN Mobile Money ou Orange Money. Les coordonnées de paiement sont écrites sur votre devis.",
      moyensAvecCompte:
        "Par MTN Mobile Money ou Orange Money, aux numéros indiqués sur votre devis, au nom de {paiement.nomCompte}.",
      regle: "Nous ne vous demanderons jamais de payer sur un autre numéro.",
      conseils:
        "Vérifiez le nom du compte avant de valider. Chaque paiement donne lieu à un reçu écrit. Un doute~? Demandez un appel vidéo depuis la ferme avant de payer.",
      numero: "Notre seul numéro WhatsApp~: **{coordonnees.whatsapp}**.",
      bouton: "Demander un appel vidéo",
    },
  },
  ferme: {
    surTitre: "La ferme",
    titre: "Une vraie ferme, à Bangangté",
    texte:
      "Hope & Peace Farm élève des poulets de chair et des chèvres à Bangangté, dans le Ndé. Nous vendons directement aux familles, aux organisateurs de cérémonies et aux professionnels de l’Ouest, et nous acceptons les commandes de Douala, de Yaoundé et de l’étranger pour une livraison dans l’Ouest. Notre promesse~: le bon compte, le bon jour, la preuve. Chaque commande est confirmée par écrit, préparée comme vous le souhaitez et livrée à la date convenue, avec des photos à chaque étape.",
    promoteur: {
      nom: "",
      fonction: "",
      texte:
        "C’est la personne qui vous répond sur WhatsApp. Elle peut vous montrer la ferme en appel vidéo avant que vous réserviez.",
    },
    engagements: {
      titre: "Nos engagements",
      promesse: "Le bon compte. Le bon jour. La preuve.",
      liste: [
        {
          titre: "Le compte juste.",
          texte:
            "Vous recevez la quantité, le calibre et la préparation commandés. S’il manque quelque chose de notre fait, nous le remplaçons ou nous vous remboursons la différence.",
        },
        {
          titre: "Le jour convenu.",
          texte:
            "Nous livrons à la date et dans le créneau écrits dans votre confirmation. En cas de retard de notre fait, les frais de livraison vous sont remboursés.",
        },
        {
          titre: "La preuve à chaque étape.",
          texte: "Pour les commandes à distance, vous recevez des photos à la préparation, au chargement et à la livraison.",
        },
        {
          titre: "La préparation propre.",
          texte:
            "Vos poulets sont préparés le jour même ou la veille, avec de l’eau propre, et remis dans un emballage fermé.",
        },
        { titre: "Le prix annoncé.", texte: "Le prix écrit sur votre devis est le prix final. Aucun supplément surprise." },
      ],
    },
    limites: {
      titre: "Nos limites, en toute franchise",
      elements: [
        "Nous ne promettons pas le moins cher.",
        "Nous livrons les zones que nous maîtrisons, pas partout au Cameroun.",
        "Un poulet se produit en 6 à 8~semaines~: au-delà de notre stock, nous annonçons un délai.",
      ],
    },
    visite: {
      titre: "Visiter la ferme",
      texte: "Visite possible sur rendez-vous, dans le respect des règles d’hygiène de l’élevage.",
      lien: "Nous trouver et nous joindre",
    },
    suivre: {
      titre: "Suivez la vie de la ferme",
      texte: "Sur notre page Facebook et sur notre chaîne WhatsApp.",
      boutonFacebook: "Suivre sur Facebook",
      boutonChaine: "Rejoindre la chaîne WhatsApp",
    },
  },
  questions: {
    surTitre: "Questions fréquentes",
    titre: "Vos questions, nos réponses",
    groupes: [
      {
        titre: "Commander",
        questions: [
          {
            question: "Comment commander~?",
            reponse:
              "Par WhatsApp au {coordonnees.whatsapp} ou avec le formulaire du site. Indiquez la quantité, la préparation, la date et le lieu~: nous vous répondons avec un prix écrit.",
          },
          {
            question: "Quelle différence entre vivant, prêt à cuire et découpé~?",
            reponse:
              "Vivant~: tel qu’il sort de la ferme. Prêt à cuire~: tué, plumé, vidé et nettoyé. Découpé~: prêt à cuire, puis découpé en morceaux pour la sauce ou la braise.",
          },
          {
            question: "Combien pèse un poulet~?",
            reponse:
              "Calibre standard~: environ 1,8 à 2,1~kg vivant. Calibre gros~: 2,2~kg et plus. Un poulet prêt à cuire pèse environ les trois quarts de son poids vivant.",
          },
          {
            question: "Combien de temps à l’avance faut-il commander~?",
            reponse:
              "Pour quelques poulets~: 24 à 72~h selon le stock. Pour une cérémonie~: 2 à 4~semaines. Pour une grande quantité~: jusqu’à 8~semaines.",
          },
          {
            question: "C’est plus cher qu’au marché~?",
            reponse:
              "Au marché, vous payez le poulet. Chez nous, vous payez le poulet et la certitude~: le bon nombre, préparé, livré le jour convenu, avec des photos. Si vous voulez seulement le prix, le poulet vivant retiré à la ferme est à partir de {prix.vivant}.",
          },
        ],
      },
      {
        titre: "Payer et annuler",
        questions: [
          {
            question: "Pourquoi un acompte~?",
            reponse:
              "Parce que nous réservons vos poulets et engageons leur préparation. L’acompte de {conditions.acomptePourcent}~% garantit votre date et votre prix~; vous recevez un reçu écrit.",
          },
          {
            question: "Comment payer~?",
            reponse:
              "Par MTN Mobile Money ou Orange Money, aux numéros indiqués sur votre devis. Nous ne vous demanderons jamais de payer sur un autre numéro.",
          },
          {
            question: "Puis-je annuler~?",
            reponse:
              "Oui. Plus de {conditions.seuilRemboursementJours}~jours avant~: acompte remboursé ou reporté. Entre {conditions.seuilRemboursementJours} et {conditions.seuilConserveJours}~jours~: acompte reporté. Moins de {conditions.seuilConserveJours}~jours~: acompte conservé, car la préparation est engagée.",
          },
          {
            question: "Et si quelque chose ne va pas~?",
            reponse:
              "Notre charte est écrite~: s’il manque un poulet de notre fait, nous le remplaçons ou nous vous remboursons~; en cas de retard de notre fait, les frais de livraison vous sont remboursés.",
          },
        ],
      },
      {
        titre: "Livraison et cérémonies",
        questions: [
          {
            question: "Livrez-vous à Douala et à Yaoundé~?",
            reponse:
              "Oui, lors de tournées groupées aux dates annoncées, à partir de 20~poulets par point de livraison. Nous livrons aussi dans tout l’Ouest pour les cérémonies.",
          },
          {
            question: "Combien de poulets pour mes invités~?",
            reponse: "Envoyez-nous le nombre d’invités et le menu~: nous calculons la quantité gratuitement, par écrit.",
          },
          {
            question: "Vendez-vous des œufs, des légumes, du plantain~?",
            reponse:
              "Pas encore au catalogue. Pour une cérémonie, nous pouvons les rechercher auprès de producteurs vérifiés et les inclure dans votre devis.",
          },
          {
            question: "Puis-je visiter la ferme~?",
            reponse: "Oui, sur rendez-vous, dans le respect des règles d’hygiène de l’élevage.",
          },
        ],
      },
      {
        titre: "Professionnels",
        questions: [
          {
            question: "Et si le calibre varie~?",
            reponse: "Le calibre convenu est garanti, avec une tolérance de ±~{conditions.toleranceGrammes}~g par poulet.",
          },
          {
            question: "Le prix peut-il changer~?",
            reponse:
              "Le tarif pro est fixé pour {conditions.prixFixeSemaines}~semaines. Il n’est révisé que si le prix de l’aliment varie de plus de {conditions.revisionAlimentPourcent}~%, avec un préavis de {conditions.preavisSemaines}~semaines.",
          },
          {
            question: "Comment se passe le paiement~?",
            reponse:
              "Vous payez à la livraison. Après {conditions.factureApresMois}~mois sans incident, nous pouvons vous facturer à {conditions.factureJours}~jours.",
          },
        ],
      },
    ],
  },
  demande: {
    titre: "Une fête, une cérémonie, une semaine chargée~?",
    chapeau: "Écrivez-nous~: nous répondons en moins de {delais.reponse}, de {horaires.debut} à {horaires.fin}.",
    etapes: [
      "Vous remplissez la demande~: 1 minute.",
      "WhatsApp s’ouvre avec votre message déjà écrit~: vous l’envoyez.",
      "Nous vous répondons avec un prix écrit.",
    ],
    boutonWhatsapp: "Commander sur WhatsApp",
    boutonAppel: "Appeler",
    formulaires: {
      ceremonie: {
        titre: "Préparons ensemble votre cérémonie.",
        texte: "Pas besoin d’être précis~: un ordre de grandeur suffit. Nous vous envoyons un devis écrit sous {delais.devis}.",
      },
      poulets: {
        titre: "Commandez vos poulets en 1~minute.",
        texte:
          "Dites-nous ce qu’il vous faut~: nous vous répondons sur WhatsApp avec un prix écrit, en moins de {delais.reponse} entre {horaires.debut} et {horaires.fin}.",
      },
      pro: {
        titre: "Devenez client pro.",
        texte: "Dites-nous vos besoins~: nous vous proposons une livraison d’essai.",
      },
    },
    confidentialite:
      "Rien n’est enregistré sur ce site~: votre message part seulement quand vous appuyez sur «~Envoyer~» dans WhatsApp.",
  },
  pied: {
    signature: "Nourrir l’avenir avec confiance",
    apropos:
      "Poulets de chair élevés à Bangangté, dans le Ndé. Vente directe aux familles, aux cérémonies et aux professionnels de l’Ouest.",
    horaires: "{horaires.debut} – {horaires.fin}, tous les jours",
  },
  legal: {
    editeur: "Hope & Peace Farm (nom commercial).",
    responsablePublication: "",
    hebergeur: "",
    propriete: "textes et photos de Hope & Peace Farm.",
  },
  confidentialite: {
    paragraphes: [
      "Ce site n’enregistre aucune donnée personnelle. Les formulaires préparent un message dans votre navigateur~; rien ne nous est envoyé tant que vous n’avez pas appuyé sur «~Envoyer~» dans WhatsApp.",
      "Les informations de votre message servent uniquement à traiter votre demande et à vous tenir informé de votre commande. Elles ne sont jamais vendues. Elles sont transmises seulement à la personne qui livre votre commande. La conversation elle-même passe par WhatsApp, selon ses propres règles.",
      "Vous pouvez demander à consulter, corriger ou supprimer vos informations en écrivant au {coordonnees.whatsapp}.",
      "Aucun cookie, aucun traceur. Votre saisie est gardée dans votre navigateur le temps de la visite, pour ne rien perdre si vous parcourez la page.",
      "Référence~: loi n°~2024/017 du 23~décembre 2024 relative à la protection des données à caractère personnel.",
    ],
  },
});
