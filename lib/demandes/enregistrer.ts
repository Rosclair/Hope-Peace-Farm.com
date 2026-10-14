// Enregistrement d’une demande validée (architecture §6) : limites de débit, puis,
// dans une même transaction, la demande, son événement « création » et l’e-mail
// au propriétaire mis en file. L’e-mail part après la réponse (route, `after()`),
// et la tâche « emails » le retente en cas d’échec.
// Un nouvel essai avec la même clé d’envoi (« Réessayer » après une coupure)
// renvoie la demande déjà enregistrée au lieu d’en créer une seconde.

import "server-only";
import { eq } from "drizzle-orm";
import { adresseNotification } from "@/lib/reglages";
import { db } from "@/lib/db/client";
import { demande as tableDemande, demandeEvenement, emailSortant, type MODES_ENVOI } from "@/lib/db/schema";
import { codeErreur, journal } from "@/lib/journal";
import { composerMessage, messageAvecReference, type Reponses } from "@/lib/whatsapp/messages";
import { appliquerLimites } from "./antispam";
import { emailNouvelleDemande } from "./email";
import { nouvelleReference } from "./reference";
import { VERSION_CONSENTEMENT, type DemandeValidee, type Envoi } from "./schema";

export type ResultatEnregistrement =
  | { statut: "enregistree" | "existante"; reference: string; message: string; emailId: number | null }
  | { statut: "limite" };

/** Réponses en chaînes, telles que les lit la composition des messages (comme FormData). */
export function reponsesTexte(d: DemandeValidee): Reponses {
  return Object.fromEntries(
    Object.entries(d.donnees).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "1" : "") : String(v)]),
  );
}

/** Message WhatsApp de la maquette pour cette demande (sans référence). */
export const messageDemande = (d: DemandeValidee) => composerMessage(d.type, reponsesTexte(d));

/** Réponses gardées dans `reponses` (nom, numéro et choix sont dans leurs colonnes). */
function reponsesStockees(d: DemandeValidee): Record<string, unknown> {
  const { whatsapp: _w, consentement: _c, annonces: _a, ...reste } = d.donnees;
  if (d.type !== "pro") delete (reste as { nom?: string }).nom;
  return reste;
}

const nomClient = (d: DemandeValidee) =>
  (d.type === "pro" ? `${d.donnees.contact} (${d.donnees.etablissement})` : d.donnees.nom).slice(0, 100);

const estDoublon = (e: unknown, index: string) => {
  const o = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = o?.cause?.code ?? o?.code;
  const texte = `${o?.cause?.message ?? ""} ${o?.message ?? ""}`;
  return code === "ER_DUP_ENTRY" && texte.includes(index);
};

async function parCle(cle: string): Promise<ResultatEnregistrement | null> {
  const [d] = await db()
    .select({ reference: tableDemande.reference, message: tableDemande.message })
    .from(tableDemande)
    .where(eq(tableDemande.cleEnvoi, cle))
    .limit(1);
  return d ? { statut: "existante", reference: d.reference, message: d.message, emailId: null } : null;
}


export async function enregistrerDemande(args: {
  demande: DemandeValidee;
  envoi: Envoi;
  mode: (typeof MODES_ENVOI)[number];
  ip: string | null;
}): Promise<ResultatEnregistrement> {
  const { demande: d, envoi, mode, ip } = args;
  const whatsapp = d.donnees.whatsapp;

  if (envoi.cle) {
    const existante = await parCle(envoi.cle);
    if (existante) return existante;
  }

  const limite = await appliquerLimites(ip, whatsapp);
  if (limite !== "ok") {
    journal.avertissement("demande refusée : limite de débit", { limite, type: d.type });
    return { statut: "limite" };
  }

  const base = messageDemande(d);
  // Destinataire : réglage du back-office, sinon NOTIFICATION_EMAIL ; null sans SMTP (la demande est gardée quand même).
  const pour = await adresseNotification();

  for (let essai = 0; essai < 3; essai++) {
    const reference = nouvelleReference();
    const message = messageAvecReference(base, reference);
    try {
      const emailId = await db().transaction(async (tx) => {
        const [r] = await tx.insert(tableDemande).values({
          reference,
          type: d.type,
          nom: nomClient(d),
          whatsappE164: whatsapp,
          reponses: reponsesStockees(d),
          message,
          consentementContactLe: new Date(),
          consentementVersion: VERSION_CONSENTEMENT,
          annonces: d.donnees.annonces,
          sourceCode: envoi.src || null,
          utmSource: envoi.utm_source || null,
          utmMedium: envoi.utm_medium || null,
          utmCampaign: envoi.utm_campaign || null,
          referentDomaine: envoi.referent || null,
          modeEnvoi: mode,
          cleEnvoi: envoi.cle ?? null,
        });
        await tx.insert(demandeEvenement).values({ demandeId: r.insertId, type: "creation", versStatut: "nouvelle" });
        if (!pour) return null;
        const email = emailNouvelleDemande({ demande: d, reference, whatsapp, message });
        const [e] = await tx.insert(emailSortant).values({
          type: "nouvelle_demande",
          destinataire: pour,
          sujet: email.sujet,
          texte: email.texte,
          html: email.html,
          demandeId: r.insertId,
        });
        return e.insertId;
      });
      journal.info("demande enregistrée", { reference, type: d.type, mode, email: emailId ?? "non configuré" });
      return { statut: "enregistree", reference, message, emailId };
    } catch (e) {
      // Même clé d’envoi enregistrée entre-temps (deux essais simultanés) : on renvoie la première.
      if (envoi.cle && estDoublon(e, "demande_cle_envoi")) {
        const existante = await parCle(envoi.cle);
        if (existante) return existante;
      }
      if (estDoublon(e, "demande_reference")) continue;
      journal.erreur("enregistrement de demande impossible", { type: d.type, erreur: codeErreur(e) });
      throw e;
    }
  }
  throw new Error("Aucune référence libre après trois tirages");
}
