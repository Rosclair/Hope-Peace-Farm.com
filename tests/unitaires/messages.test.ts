// Les messages WhatsApp du site sont comparés à ceux que compose le JavaScript de
// la maquette lui-même (fonctions compose et thanks de reference/extrait/principal.js,
// extraites et exécutées telles quelles), cas par cas.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  composerMessage,
  lienWa,
  MESSAGE_COMMANDE,
  MESSAGE_FETES,
  MESSAGE_GENERAL,
  MESSAGE_VIDEO,
  messageFetesGaranti,
  texteRemerciement,
  type Reponses,
  type TypeDemande,
} from "@/lib/whatsapp/messages";

type Compose = (type: string, data: Reponses) => string;

const principal = readFileSync("reference/extrait/principal.js", "utf8");
const extrait = (debut: string, fin: string) => {
  const i = principal.indexOf(debut);
  const j = principal.indexOf(fin, i);
  if (i < 0 || j < 0) throw new Error(`Bloc introuvable dans principal.js : ${debut}`);
  return principal.slice(i, j);
};
// MONTHS + frDate, puis PREP … thanks (section 6), exécutés hors de la page.
const maquette = new Function(
  `${extrait("const MONTHS", "const storage")}
   ${extrait("const PREP", "Object.entries(forms)")}
   return { compose, thanks, frDate };`,
)() as { compose: Compose; thanks: Compose; frDate: (iso: string) => string };

const CAS: [TypeDemande, Reponses][] = [
  ["ceremonie", { ceremonie: "funerailles", date: "2026-12-19", lieu: "Bazou, chefferie, près du marché", invites: "100 à 200", nom: "Exemple Test", residence: "Douala" }],
  ["ceremonie", { ceremonie: "mariage", date_inconnue: "1", date: "", lieu: "  Bangangté   centre ", invites: "plus de 400", nom: " Marie  N. ", residence: "Paris", precisions: "Chèvres aussi\net plantain", annonces: "1" }],
  ["ceremonie", { ceremonie: "bapteme", date: "2027-01-01", lieu: "Bafoussam", invites: "moins de 100", nom: "Jean", residence: "Yaoundé", precisions: "x".repeat(320) }],
  ["ceremonie", { ceremonie: "inconnue", date: "2026-11-30", lieu: "Ndé", invites: "200 à 400", nom: "A", residence: "B" }],
  ["poulets", { nombre: "1", preparation: "vivant", date: "2026-12-24", reception: "retrait", nom: "Paul" }],
  ["poulets", { nombre: "25", preparation: "sauce", date: "2026-10-20", reception: "livraison", lieu: "Douala, Bonapriso", nom: "Awa", precisions: "Avant 10 h", annonces: "1" }],
  ["poulets", { nombre: "9999", preparation: "braise", date: "2026-11-01", reception: "livraison", lieu: "Bangangté", nom: "Luc" }],
  ["poulets", { nombre: "3", preparation: "pret", date: "2027-03-05", reception: "retrait", nom: "Éric", lieu: "ignoré" }],
  ["pro", { etablissement: "Chez Mama", type: "restaurant", ville: "Bafoussam, marché A", volume: "10 à 30", preparation: "prêts à cuire", contact: "Mama, gérante" }],
  ["pro", { etablissement: "Hôtel du Ndé", type: "hôtel", ville: "Bangangté", volume: "plus de 60", preparation: "découpés", contact: "M. K", precisions: "Livraison le lundi", annonces: "1" }],
];

describe("messages WhatsApp des formulaires", () => {
  it.each(CAS)("%s : même message que la maquette (%#)", (type, reponses) => {
    expect(composerMessage(type, reponses)).toBe(maquette.compose(type, reponses));
  });

  it.each(CAS)("%s : même remerciement que la maquette (%#)", (type, reponses) => {
    expect(texteRemerciement(type, reponses)).toBe(maquette.thanks(type, reponses));
  });

  it("reproduit le message de référence relevé sur la maquette en phase 0", () => {
    const [type, reponses] = CAS[0]!;
    expect(composerMessage(type, reponses)).toBe(
      "Bonjour Hope & Peace Farm, je prépare des funérailles le 19 décembre 2026 à Bazou, chefferie, près du marché, pour 100 à 200 invités. Je souhaite un devis. Nom : Exemple Test, j’habite à Douala.",
    );
  });
});

describe("liens WhatsApp de la page", () => {
  const structure = readFileSync("reference/extrait/structure.html", "utf8");
  const messages = new Set(
    [...structure.matchAll(/href="https:\/\/wa\.me\/237693645565\?text=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]!)),
  );

  it("reprennent les messages de la maquette (apostrophe typographique corrigée)", () => {
    const attendus = [MESSAGE_GENERAL, MESSAGE_VIDEO, MESSAGE_COMMANDE, MESSAGE_FETES].map((m) => m.replace("J’aimerais", "J'aimerais"));
    expect(new Set(attendus)).toEqual(messages);
  });

  it("encodent le message comme la maquette", () => {
    expect(lienWa("237693645565", "Bonjour Hope & Peace Farm, à bientôt.")).toBe(
      "https://wa.me/237693645565?text=Bonjour%20Hope%20%26%20Peace%20Farm%2C%20%C3%A0%20bient%C3%B4t.",
    );
  });

  it("message des Fêtes avec garantie : même date que la maquette", () => {
    expect(messageFetesGaranti("2026-11-01")).toBe(
      `Bonjour Hope & Peace Farm, je souhaite réserver mes poulets pour les fêtes (prix garanti avant le ${maquette.frDate("2026-11-01")}).`,
    );
  });
});
