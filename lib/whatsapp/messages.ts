// Messages WhatsApp pré-remplis, repris de la maquette (reference/extrait/principal.js,
// section 6, et liens wa.me de la page). Ils restent dans le code : la mesure et les
// tests en dépendent. Module pur, partagé par le serveur et le moteur du navigateur.
// Seule correction permise appliquée : apostrophe typographique (« J’aimerais »).

/** Message des boutons « WhatsApp » génériques (menu, accueil, pied de page, barre fixe). */
export const MESSAGE_GENERAL = "Bonjour Hope & Peace Farm, je viens de votre site. J’aimerais parler à la ferme.";
/** « Appel vidéo depuis la ferme » (accueil, cérémonies, paiement). */
export const MESSAGE_VIDEO =
  "Bonjour Hope & Peace Farm, je souhaite un appel vidéo depuis la ferme avant de réserver.";
/** « Commander sur WhatsApp » (section « Votre demande »). */
export const MESSAGE_COMMANDE = "Bonjour Hope & Peace Farm, je viens de votre site. Je souhaite passer une commande.";
/** « Réserver sur WhatsApp » (Fêtes), après la date limite du prix garanti. */
export const MESSAGE_FETES = "Bonjour Hope & Peace Farm, je souhaite réserver mes poulets pour les fêtes.";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-12-19 » → « 19 décembre 2026 » (espaces simples, comme les messages de la maquette). */
export function dateMessage(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j === 1 ? "1er" : j} ${MOIS[(m ?? 1) - 1]} ${a}`;
}

/** « Réserver sur WhatsApp » avant la date limite : message avec la garantie de prix. */
export function messageFetesGaranti(dateLimite: string): string {
  return `Bonjour Hope & Peace Farm, je souhaite réserver mes poulets pour les fêtes (prix garanti avant le ${dateMessage(dateLimite)}).`;
}

export type TypeDemande = "ceremonie" | "poulets" | "pro";

/** Réponses d’un formulaire, telles que FormData les donne (chaînes). */
export type Reponses = Record<string, string | undefined>;

const PREP: Record<string, [string, string]> = {
  vivant: ["vivant", "vivants"],
  pret: ["prêt à cuire", "prêts à cuire"],
  sauce: ["découpé pour la sauce", "découpés pour la sauce"],
  braise: ["découpé pour la braise", "découpés pour la braise"],
};
const CEREMONIE: Record<string, string> = {
  funerailles: "des funérailles",
  mariage: "un mariage",
  dot: "une dot",
  bapteme: "un baptême",
  retour: "un retour au village",
  autre: "une cérémonie",
};
const ANNONCES = "J’accepte de recevoir vos annonces (deux messages par mois au plus).";

const propre = (v: unknown) => String(v || "").replace(/\s+/g, " ").trim();
const couper = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

/** Message WhatsApp composé à partir des réponses (fonction `compose` de la maquette). */
export function composerMessage(type: TypeDemande, d: Reponses): string {
  const precisions = propre(d.precisions);
  const nom = propre(d.nom);
  let texte: string;
  if (type === "poulets") {
    const n = parseInt(d.nombre ?? "", 10);
    const prep = (PREP[d.preparation ?? ""] ?? ["", ""])[n > 1 ? 1 : 0];
    const reception = d.reception === "livraison" ? `livraison à ${propre(d.lieu)}` : "retrait à la ferme";
    texte = `Bonjour Hope & Peace Farm, je souhaite commander ${n} ${n > 1 ? "poulets" : "poulet"} ${prep}, pour le ${dateMessage(d.date ?? "")}, ${reception}. Nom : ${nom}.`;
    if (precisions) texte += ` Précision : ${couper(precisions, 300)}`;
  } else if (type === "ceremonie") {
    const quand = d.date_inconnue ? "(date à confirmer)" : `le ${dateMessage(d.date ?? "")}`;
    texte = `Bonjour Hope & Peace Farm, je prépare ${CEREMONIE[d.ceremonie ?? ""] ?? "une cérémonie"} ${quand} à ${propre(d.lieu)}, pour ${d.invites} invités. Je souhaite un devis. Nom : ${nom}, j’habite à ${propre(d.residence)}.`;
    if (precisions) texte += ` Précisions : ${couper(precisions, 300)}`;
  } else {
    texte = `Bonjour Hope & Peace Farm, je souhaite une livraison d’essai pour ${propre(d.etablissement)} (${d.type}) à ${propre(d.ville)}. Besoin : ${d.volume} poulets par semaine, ${d.preparation}. Contact : ${propre(d.contact)}.`;
    if (precisions) texte += ` Précisions : ${couper(precisions, 300)}`;
  }
  if (d.annonces) texte += `\n${ANNONCES}`;
  return texte;
}

/** Texte de remerciement de la vue de succès (fonction `thanks` de la maquette). */
export function texteRemerciement(type: TypeDemande, d: Reponses): string {
  const pret =
    "Votre demande est prête. Le bouton ci-dessous ouvre WhatsApp avec le récapitulatif : appuyez sur « Envoyer ».";
  if (type === "poulets") return `Merci ${propre(d.nom)} ! ${pret} Nous vous répondons avec le prix et la disponibilité.`;
  if (type === "ceremonie") return `Merci ${propre(d.nom)}. ${pret} Nous vous envoyons votre devis écrit sous 24 h.`;
  return `Merci. ${pret} Nous vous contactons sous 24 h pour organiser votre livraison d’essai.`;
}

/** Lien wa.me avec message (encodage identique à la maquette). */
export function lienWa(numero: string, message: string): string {
  return `https://wa.me/${numero.replace(/[^0-9A-Za-z]/g, "")}?text=${encodeURIComponent(message)}`;
}
