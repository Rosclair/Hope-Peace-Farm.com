// Document de contenu de la page publique (voir docs/modele-donnees.md §1).
// En phase 2, la page est rendue à partir du contenu initial (= maquette) ;
// en phase 3, ce même document sera stocké en base, validé par Zod et publié.
//
// Les textes « riches » acceptent trois marques, et rien d’autre :
//   {groupe.cle}      valeur mise en forme au rendu (prix, date, numéro…), voir reperes.ts ;
//   **texte**         gras ;
//   [libellé](#ancre) lien vers une ancre de la page.
// Les libellés des formulaires, les messages WhatsApp pré-remplis, le menu et
// les ancres restent dans le code (mesure, tests et comportements en dépendent).

/** Texte qui peut contenir des repères `{…}`, du **gras** et des liens d’ancre. */
export type TexteRiche = string;

/** Date au format AAAA-MM-JJ (jour calendaire à Douala). */
export type DateIso = string;

export type Icone =
  | "i-arrow" | "i-calendar" | "i-camera" | "i-channel" | "i-chat" | "i-check" | "i-chevron" | "i-clock"
  | "i-close" | "i-copy" | "i-doc" | "i-facebook" | "i-farm" | "i-help" | "i-home" | "i-menu" | "i-people"
  | "i-phone" | "i-pin" | "i-receipt" | "i-shield" | "i-store" | "i-truck" | "i-video";

export interface Titre {
  titre: TexteRiche;
}

export interface EnteteSection {
  surTitre: TexteRiche;
  titre: TexteRiche;
}

export interface Formule {
  nom: string;
  pourQui: TexteRiche;
  /** « Tout l’Essentiel, plus : » ; vide pour la première formule. */
  plus: TexteRiche;
  elements: TexteRiche[];
  delai: TexteRiche;
}

export interface ContenuPage {
  seo: {
    titre: string;
    description: string;
    /** Description de l’entreprise (JSON-LD). */
    descriptionEntreprise: string;
    zonesDesservies: string[];
  };
  coordonnees: {
    /** Numéro WhatsApp, chiffres seuls avec l’indicatif (ex. 237693645565). */
    whatsapp: string;
    /** Numéro d’appel au format international (ex. +237693645565). */
    telephone: string;
    emailContact: string;
    adresse: string;
    lienItineraire: string;
    facebook: string;
    chaineWhatsapp: string;
  };
  horaires: { debut: string; fin: string };
  delais: { reponse: string; devis: string };
  /** Prix « à partir de », en FCFA. */
  prix: { vivant: number; pretACuire: number; decoupe: number };
  conditions: {
    acomptePourcent: number;
    soldeJoursAvant: number;
    minimumCeremonie: number;
    minimumHorsNde: number;
    seuilRemboursementJours: number;
    seuilConserveJours: number;
    avoirMois: number;
    prixFixeSemaines: number;
    factureApresMois: number;
    factureJours: number;
    toleranceGrammes: number;
    revisionAlimentPourcent: number;
    preavisSemaines: number;
  };
  paiement: { mtn: string; orange: string; nomCompte: string };
  fetes: {
    actif: boolean;
    dateLimitePrixGaranti: DateIso;
    dateFin: DateIso;
    clotureNoel: DateIso;
    clotureNouvelAn: DateIso;
    /** Phrase de garantie de prix, masquée après la date limite. */
    garantie: TexteRiche;
    bandeau: { annonce: TexteRiche; lien: string };
    bloc: {
      titre: TexteRiche;
      texteAvant: TexteRiche;
      texteApres: TexteRiche;
      libelleClotureNoel: string;
      libelleClotureNouvelAn: string;
      bouton: string;
    };
  };
  accueil: {
    surTitre: TexteRiche;
    /** Les lignes du titre (une par <span>). */
    titre: string[];
    chapeau: TexteRiche;
    boutonPrincipal: string;
    lienWhatsapp: string;
    suivi: {
      etiquette: string;
      titre: string;
      detail: TexteRiche;
      etapes: { quoi: TexteRiche; quand: string }[];
      pied: TexteRiche;
    };
  };
  garanties: Titre & { elements: { icone: Icone; texte: TexteRiche }[] };
  choix: Titre & {
    portes: Record<"ceremonie" | "maison" | "pro", { titre: string; texte: TexteRiche; prix: TexteRiche }>;
    etranger: { question: TexteRiche; lien: string };
  };
  deroule: Titre & { etapes: TexteRiche[] };
  ceremonies: EnteteSection & {
    chapeau: TexteRiche;
    bouton: string;
    formules: Titre & {
      liste: [Formule, Formule, Formule];
      /** Tableau comparatif (ordinateur) : une ligne par critère, une cellule par formule ; vide = « Non ». */
      tableau: { critere: string; valeurs: [TexteRiche, TexteRiche, TexteRiche] }[];
      conditions: TexteRiche[];
    };
    methode: Titre & { etapes: TexteRiche[] };
    exemple: Titre & {
      quantite: number;
      libelle: string;
      total: string;
      acompte: TexteRiche;
      solde: string;
      note: TexteRiche;
      mention: TexteRiche;
    };
    distance: Titre & { texte: TexteRiche; bouton: string; lien: string };
  };
  poulets: EnteteSection & {
    chapeau: TexteRiche;
    bouton: string;
    preparations: Titre & {
      liste: { nom: string; description: TexteRiche; prix: TexteRiche }[];
      calibres: Titre & { texte: TexteRiche };
      prixFinal: TexteRiche;
    };
  };
  pro: EnteteSection & {
    chapeau: TexteRiche;
    bouton: string;
    garanties: Titre & { elements: TexteRiche[] };
    essai: Titre & { texte: TexteRiche };
  };
  livraison: EnteteSection & {
    zones: { nom: string; regle: TexteRiche }[];
    note: TexteRiche;
    minimums: Titre & { texte: TexteRiche };
    paiement: Titre & { regles: { cas: TexteRiche; regle: TexteRiche }[] };
    annulation: Titre & { paliers: { quand: TexteRiche; quoi: TexteRiche }[] };
    securite: Titre & {
      moyens: TexteRiche;
      /** Remplace `moyens` quand le nom du compte est renseigné. */
      moyensAvecCompte: TexteRiche;
      regle: TexteRiche;
      conseils: TexteRiche;
      numero: TexteRiche;
      bouton: string;
    };
  };
  ferme: EnteteSection & {
    texte: TexteRiche;
    /** Bloc masqué tant que le nom, la fonction et la photo manquent (phase 6). */
    promoteur: { nom: string; fonction: string; texte: TexteRiche };
    engagements: Titre & { promesse: TexteRiche; liste: { titre: string; texte: TexteRiche }[] };
    limites: Titre & { elements: TexteRiche[] };
    visite: Titre & { texte: TexteRiche; lien: string };
    suivre: Titre & { texte: TexteRiche; boutonFacebook: string; boutonChaine: string };
  };
  questions: EnteteSection & {
    groupes: { titre: string; questions: { question: TexteRiche; reponse: TexteRiche }[] }[];
  };
  demande: Titre & {
    chapeau: TexteRiche;
    etapes: TexteRiche[];
    boutonWhatsapp: string;
    boutonAppel: string;
    formulaires: Record<"ceremonie" | "poulets" | "pro", { titre: TexteRiche; texte: TexteRiche }>;
    confidentialite: TexteRiche;
  };
  pied: {
    signature: string;
    apropos: TexteRiche;
    horaires: TexteRiche;
  };
  legal: {
    editeur: TexteRiche;
    responsablePublication: string;
    hebergeur: TexteRiche;
    propriete: TexteRiche;
  };
  confidentialite: { paragraphes: TexteRiche[] };
}
