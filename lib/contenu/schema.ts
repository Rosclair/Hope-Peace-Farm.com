// Schéma Zod du document de contenu (docs/modele-donnees.md §1). Il valide le
// brouillon à chaque enregistrement, chaque version avant publication et le
// contenu relu en base avant le rendu. Les types de lib/contenu/types.ts en sont
// déduits : une seule définition.
//
// Règles générales : textes exacts (aucune transformation), longueurs bornées,
// champs obligatoires non vides ; une chaîne vide est permise seulement là où la
// maquette prévoit une valeur absente (le bloc correspondant est alors masqué).
// Liens sortants limités à ceux que le brief permet : WhatsApp, Facebook, chaîne
// WhatsApp, Google Maps.

import { z } from "zod";

// Messages d’erreur de Zod en français (ceux qui ne sont pas écrits ci-dessous).
z.config(z.locales.fr());

export const ICONES = [
  "i-arrow", "i-calendar", "i-camera", "i-channel", "i-chat", "i-check", "i-chevron", "i-clock",
  "i-close", "i-copy", "i-doc", "i-facebook", "i-farm", "i-help", "i-home", "i-menu", "i-people",
  "i-phone", "i-pin", "i-receipt", "i-shield", "i-store", "i-truck", "i-video",
] as const;

const OBLIGATOIRE = "Champ obligatoire.";

/** Texte facultatif (peut être vide). */
const texte = (max: number) => z.string().max(max, `${max} caractères au plus.`);
/** Texte obligatoire : au moins un caractère visible. */
const requis = (max: number) => texte(max).refine((t) => t.trim().length > 0, OBLIGATOIRE);
/** Vide, ou valeur conforme au schéma donné. */
const videOu = <S extends z.ZodType<string>>(schema: S) => z.union([z.literal(""), schema]);

const date = z.iso.date({ error: "Date attendue au format AAAA-MM-JJ." });
const entier = (min: number, max: number) => z.number().int("Nombre entier attendu.").min(min).max(max);

const numeroWhatsApp = z.string().regex(/^[1-9]\d{7,14}$/, "Chiffres seuls avec l’indicatif, sans + (ex. 237693645565).");
const numeroAppel = z.string().regex(/^\+[1-9]\d{7,14}$/, "Format international attendu (ex. +237693645565).");
const numeroPaiement = z.string().regex(/^\+?[1-9]\d{7,14}$/, "Numéro avec l’indicatif (ex. +237670000000).");

const lienFacebook = z.url({
  protocol: /^https$/,
  hostname: /^(www\.|m\.|web\.)?facebook\.com$/,
  error: "Adresse https://…facebook.com/… attendue.",
});
const lienChaine = z
  .url({ protocol: /^https$/, hostname: /^(www\.)?whatsapp\.com$/, error: "Adresse https://whatsapp.com/channel/… attendue." })
  .refine((u) => new URL(u).pathname.startsWith("/channel/"), "Adresse https://whatsapp.com/channel/… attendue.");
const lienCarte = z
  .url({
    protocol: /^https$/,
    hostname: /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.(com|cm|fr))$/,
    error: "Lien Google Maps attendu.",
  })
  .refine((u) => {
    const { hostname, pathname } = new URL(u);
    return hostname === "maps.app.goo.gl" || hostname.startsWith("maps.") || pathname.startsWith("/maps");
  }, "Lien Google Maps attendu.");

const titre = { titre: requis(160) };
const enteteSection = { surTitre: requis(80), titre: requis(200) };

const formule = z.strictObject({
  nom: requis(40),
  pourQui: requis(200),
  /** « Tout l’Essentiel, plus : » ; vide pour la première formule. */
  plus: texte(80),
  elements: z.array(requis(240)).min(1).max(10),
  delai: requis(120),
});

/** Une des trois portes de « Que préparez-vous ? » (prix : vide = pas de ligne de prix). */
const porte = z.strictObject({ titre: requis(60), texte: requis(240), prix: texte(80) });
/** Titre et texte d’introduction d’un formulaire de demande. */
const introFormulaire = z.strictObject({ titre: requis(120), texte: requis(400) });

export const schemaContenu = z.strictObject({
  seo: z.strictObject({
    titre: requis(90),
    description: requis(200),
    /** Description de l’entreprise (JSON-LD). */
    descriptionEntreprise: requis(500),
    zonesDesservies: z.array(requis(60)).min(1).max(20),
  }),
  coordonnees: z.strictObject({
    /** Numéro WhatsApp, chiffres seuls avec l’indicatif (ex. 237693645565). */
    whatsapp: numeroWhatsApp,
    /** Numéro d’appel au format international (ex. +237693645565). */
    telephone: numeroAppel,
    emailContact: videOu(z.email({ error: "Adresse e-mail invalide." })),
    adresse: requis(160),
    lienItineraire: videOu(lienCarte),
    facebook: lienFacebook,
    chaineWhatsapp: lienChaine,
  }),
  horaires: z.strictObject({ debut: requis(20), fin: requis(20) }),
  delais: z.strictObject({ reponse: requis(40), devis: requis(40) }),
  /** Prix « à partir de », en FCFA. */
  prix: z.strictObject({ vivant: entier(0, 1_000_000), pretACuire: entier(0, 1_000_000), decoupe: entier(0, 1_000_000) }),
  conditions: z.strictObject({
    acomptePourcent: entier(0, 100),
    soldeJoursAvant: entier(0, 60),
    minimumCeremonie: entier(0, 10_000),
    minimumHorsNde: entier(0, 10_000),
    seuilRemboursementJours: entier(0, 365),
    seuilConserveJours: entier(0, 365),
    avoirMois: entier(0, 60),
    prixFixeSemaines: entier(0, 52),
    factureApresMois: entier(0, 60),
    factureJours: entier(0, 90),
    toleranceGrammes: entier(0, 2000),
    revisionAlimentPourcent: entier(0, 100),
    preavisSemaines: entier(0, 52),
  }),
  paiement: z.strictObject({ mtn: videOu(numeroPaiement), orange: videOu(numeroPaiement), nomCompte: texte(80) }),
  fetes: z
    .strictObject({
      actif: z.boolean(),
      dateLimitePrixGaranti: date,
      dateFin: date,
      clotureNoel: date,
      clotureNouvelAn: date,
      /** Phrase de garantie de prix, masquée après la date limite. */
      garantie: requis(200),
      bandeau: z.strictObject({ annonce: requis(160), lien: requis(60) }),
      bloc: z.strictObject({
        titre: requis(160),
        texteAvant: requis(800),
        texteApres: requis(800),
        libelleClotureNoel: requis(40),
        libelleClotureNouvelAn: requis(40),
        bouton: requis(40),
      }),
    })
    .superRefine((f, ctx) => {
      const avant = (a: string, b: string) => a <= b;
      if (!avant(f.dateLimitePrixGaranti, f.dateFin))
        ctx.addIssue({ code: "custom", path: ["dateLimitePrixGaranti"], message: "La date limite du prix garanti doit précéder la fin des Fêtes." });
      if (!avant(f.clotureNoel, f.dateFin))
        ctx.addIssue({ code: "custom", path: ["clotureNoel"], message: "La clôture de Noël doit précéder la fin des Fêtes." });
      if (!avant(f.clotureNouvelAn, f.dateFin))
        ctx.addIssue({ code: "custom", path: ["clotureNouvelAn"], message: "La clôture du Nouvel An doit précéder la fin des Fêtes." });
    }),
  accueil: z.strictObject({
    surTitre: requis(80),
    /** Les lignes du titre (une par <span>). */
    titre: z.array(requis(80)).min(1).max(4),
    chapeau: requis(300),
    boutonPrincipal: requis(40),
    lienWhatsapp: requis(40),
    suivi: z.strictObject({
      etiquette: requis(40),
      titre: requis(80),
      detail: requis(160),
      etapes: z.array(z.strictObject({ quoi: requis(120), quand: requis(20) })).min(1).max(8),
      pied: requis(160),
    }),
  }),
  garanties: z.strictObject({ ...titre, elements: z.array(z.strictObject({ icone: z.enum(ICONES), texte: requis(120) })).min(1).max(8) }),
  choix: z.strictObject({
    ...titre,
    portes: z.strictObject({ ceremonie: porte, maison: porte, pro: porte }),
    etranger: z.strictObject({ question: requis(80), lien: requis(60) }),
  }),
  deroule: z.strictObject({ ...titre, etapes: z.array(requis(200)).min(1).max(8) }),
  ceremonies: z.strictObject({
    ...enteteSection,
    chapeau: requis(800),
    bouton: requis(60),
    formules: z.strictObject({
      ...titre,
      liste: z.tuple([formule, formule, formule]),
      /** Tableau comparatif (ordinateur) : une ligne par critère, une cellule par formule ; vide = « Non ». */
      tableau: z.array(z.strictObject({ critere: requis(40), valeurs: z.tuple([texte(240), texte(240), texte(240)]) })).min(1).max(12),
      conditions: z.array(requis(600)).min(1).max(6),
    }),
    methode: z.strictObject({ ...titre, etapes: z.array(requis(240)).min(1).max(10) }),
    exemple: z.strictObject({
      ...titre,
      quantite: entier(1, 10_000),
      libelle: requis(60),
      total: requis(80),
      acompte: requis(80),
      solde: requis(40),
      note: requis(240),
      mention: requis(240),
    }),
    distance: z.strictObject({ ...titre, texte: requis(400), bouton: requis(60), lien: requis(60) }),
  }),
  poulets: z.strictObject({
    ...enteteSection,
    chapeau: requis(400),
    bouton: requis(60),
    preparations: z.strictObject({
      ...titre,
      liste: z.array(z.strictObject({ nom: requis(40), description: requis(120), prix: requis(60) })).min(1).max(6),
      calibres: z.strictObject({ ...titre, texte: requis(400) }),
      prixFinal: requis(400),
    }),
  }),
  pro: z.strictObject({
    ...enteteSection,
    chapeau: requis(600),
    bouton: requis(60),
    garanties: z.strictObject({ ...titre, elements: z.array(requis(80)).min(1).max(8) }),
    essai: z.strictObject({ ...titre, texte: requis(300) }),
  }),
  livraison: z.strictObject({
    ...enteteSection,
    zones: z.array(z.strictObject({ nom: requis(60), regle: requis(200) })).min(1).max(12),
    note: requis(400),
    minimums: z.strictObject({ ...titre, texte: requis(400) }),
    paiement: z.strictObject({ ...titre, regles: z.array(z.strictObject({ cas: requis(120), regle: requis(300) })).min(1).max(10) }),
    annulation: z.strictObject({ ...titre, paliers: z.array(z.strictObject({ quand: requis(160), quoi: requis(240) })).min(1).max(6) }),
    securite: z.strictObject({
      ...titre,
      moyens: requis(300),
      /** Remplace `moyens` quand le nom du compte est renseigné. */
      moyensAvecCompte: requis(300),
      regle: requis(200),
      conseils: requis(400),
      numero: requis(160),
      bouton: requis(60),
    }),
  }),
  ferme: z.strictObject({
    ...enteteSection,
    texte: requis(1500),
    /** Bloc masqué tant que le nom, la fonction et la photo manquent (phase 6). */
    promoteur: z.strictObject({ nom: texte(80), fonction: texte(80), texte: requis(400) }),
    engagements: z.strictObject({
      ...titre,
      promesse: requis(160),
      liste: z.array(z.strictObject({ titre: requis(80), texte: requis(400) })).min(1).max(8),
    }),
    limites: z.strictObject({ ...titre, elements: z.array(requis(240)).min(1).max(8) }),
    visite: z.strictObject({ ...titre, texte: requis(300), lien: requis(60) }),
    suivre: z.strictObject({ ...titre, texte: requis(200), boutonFacebook: requis(60), boutonChaine: requis(60) }),
  }),
  questions: z.strictObject({
    ...enteteSection,
    /** Les 4 groupes de la maquette (brief §4) : nombre fixe, questions libres. */
    groupes: z
      .array(z.strictObject({ titre: requis(60), questions: z.array(z.strictObject({ question: requis(200), reponse: requis(1200) })).max(20) }))
      .length(4),
  }),
  demande: z.strictObject({
    ...titre,
    chapeau: requis(300),
    etapes: z.array(requis(200)).min(1).max(5),
    boutonWhatsapp: requis(60),
    boutonAppel: requis(40),
    formulaires: z.strictObject({ ceremonie: introFormulaire, poulets: introFormulaire, pro: introFormulaire }),
    confidentialite: requis(400),
  }),
  pied: z.strictObject({ signature: requis(80), apropos: requis(400), horaires: requis(120) }),
  legal: z.strictObject({
    editeur: requis(200),
    responsablePublication: texte(120),
    hebergeur: texte(300),
    propriete: requis(200),
  }),
  confidentialite: z.strictObject({ paragraphes: z.array(requis(1500)).min(1).max(12) }),
});
