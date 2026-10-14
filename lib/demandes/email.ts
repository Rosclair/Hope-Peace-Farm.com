// E-mail « nouvelle demande » envoyé au propriétaire (architecture §7) : texte brut
// et HTML simple, sans image ni ressource distante. Il contient les réponses du
// client (c’est son objet) ; le journal applicatif, lui, ne cite que la référence.

import { chiffresWa } from "./numero";
import type { DemandeValidee } from "./schema";

const TYPES = { ceremonie: "Cérémonie", poulets: "Poulets", pro: "Pro" } as const;

const CEREMONIES: Record<string, string> = {
  funerailles: "Funérailles",
  mariage: "Mariage",
  dot: "Dot",
  bapteme: "Baptême",
  retour: "Retour au village",
  autre: "Autre",
};
const PREPARATIONS: Record<string, string> = {
  vivant: "Vivant",
  pret: "Prêt à cuire",
  sauce: "Découpé sauce (10 à 12 morceaux)",
  braise: "Découpé braise (ouvert ou en 4)",
};

/** Date AAAA-MM-JJ → JJ/MM/AAAA. */
const date = (iso: string) => iso.split("-").reverse().join("/");

/** Lignes « libellé : valeur » de la demande, dans l’ordre des formulaires. */
export function lignesDemande(d: DemandeValidee, whatsapp: string): [string, string][] {
  const l: [string, string | undefined][] = [];
  if (d.type === "ceremonie") {
    const r = d.donnees;
    l.push(
      ["Type de cérémonie", CEREMONIES[r.ceremonie]],
      ["Date", r.date_inconnue ? "pas encore fixée" : date(r.date)],
      ["Lieu", r.lieu],
      ["Nombre d’invités", r.invites],
      ["Prénom et nom", r.nom],
      ["Habite à", r.residence],
    );
  } else if (d.type === "poulets") {
    const r = d.donnees;
    l.push(
      ["Nombre de poulets", r.nombre],
      ["Préparation", PREPARATIONS[r.preparation]],
      ["Date souhaitée", date(r.date)],
      ["Réception", r.reception === "livraison" ? "Livraison" : "Retrait à la ferme"],
      ["Lieu de livraison", r.lieu || undefined],
      ["Prénom et nom", r.nom],
    );
  } else {
    const r = d.donnees;
    l.push(
      ["Établissement", r.etablissement],
      ["Type d’établissement", r.type],
      ["Ville et quartier", r.ville],
      ["Volume par semaine", r.volume],
      ["Préparation", r.preparation],
      ["Contact", r.contact],
    );
  }
  l.push(
    ["Précisions", d.donnees.precisions || undefined],
    ["Numéro WhatsApp", whatsapp],
    ["Annonces", d.donnees.annonces ? "accepte de les recevoir" : "non"],
  );
  return l.filter((x): x is [string, string] => Boolean(x[1]));
}

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailNouvelleDemande(args: {
  demande: DemandeValidee;
  reference: string;
  whatsapp: string;
  message: string;
}): { sujet: string; texte: string; html: string } {
  const { demande, reference, whatsapp, message } = args;
  const lignes = lignesDemande(demande, whatsapp);
  const lien = `https://wa.me/${chiffresWa(whatsapp)}`;
  const sujet = `Nouvelle demande ${TYPES[demande.type]} — ${reference}`;
  const texte = [
    `Nouvelle demande ${TYPES[demande.type]}, référence ${reference}.`,
    "",
    ...lignes.map(([k, v]) => `${k} : ${v}`),
    "",
    "Message proposé au client sur WhatsApp :",
    message,
    "",
    `Écrire au client sur WhatsApp : ${lien}`,
    "",
    "Le client a accepté d’être contacté sur WhatsApp au sujet de sa demande.",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1b2a1f;line-height:1.5">
<h1 style="font-size:20px;color:#104A21">Nouvelle demande ${echapper(TYPES[demande.type])}</h1>
<p>Référence : <strong>${echapper(reference)}</strong></p>
<table cellpadding="6" style="border-collapse:collapse">${lignes
    .map(
      ([k, v]) =>
        `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd">${echapper(k)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${echapper(v)}</td></tr>`,
    )
    .join("")}</table>
<p><a href="${echapper(lien)}" style="display:inline-block;padding:10px 16px;background:#104A21;color:#fff;border-radius:6px;text-decoration:none">Écrire au client sur WhatsApp</a></p>
<p style="color:#555">Message proposé au client :</p>
<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #104A21;white-space:pre-wrap">${echapper(message)}</blockquote>
<p style="color:#555;font-size:13px">Le client a accepté d’être contacté sur WhatsApp au sujet de sa demande.</p>
</body></html>`;
  return { sujet, texte, html };
}
