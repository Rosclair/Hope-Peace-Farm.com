// Réception d’une demande (architecture §6). Deux façons d’envoyer :
//   - le moteur du navigateur (JSON) : réponse { reference, message, lien } ;
//   - un formulaire envoyé sans JavaScript : redirection 303 vers
//     /demande/confirmation, avec un jeton signé (aucune donnée personnelle dans l’URL).
// Tout est revalidé par Zod. Anti-spam : origine, champ piège, délai minimal,
// limites de débit. L’e-mail au propriétaire part après la réponse.

import { after, connection } from "next/server";
import { configDemandes, configSite } from "@/lib/config";
import { contenuPublie } from "@/lib/contenu/lecture";
import { adresseVisiteur, DELAI_MINIMAL_MS, origineValide } from "@/lib/demandes/antispam";
import { enregistrerDemande, messageDemande } from "@/lib/demandes/enregistrer";
import { signerConfirmation } from "@/lib/demandes/jeton";
import { validerDemande } from "@/lib/demandes/schema";
import { codeErreur, journal } from "@/lib/journal";
import { envoyerEmail } from "@/lib/mail/file";
import { lienWa } from "@/lib/whatsapp/messages";

const TAILLE_MAX = 16 * 1024;
const SANS_CACHE = { "Cache-Control": "no-store" } as const;

type Erreur = "origine" | "validation" | "limite" | "serveur" | "taille";
const STATUTS: Record<Erreur, number> = { origine: 403, validation: 400, limite: 429, serveur: 500, taille: 413 };

const json = (corps: unknown, status = 200) => Response.json(corps, { status, headers: SANS_CACHE });
const vers = (chemin: string) => new Response(null, { status: 303, headers: { Location: chemin, ...SANS_CACHE } });

/** Source de la visite d’un envoi sans JavaScript : paramètres de l’adresse de la page (Referer). */
function sourceDepuisReferer(entetes: Headers): Record<string, string> {
  try {
    const p = new URL(entetes.get("referer") ?? "").searchParams;
    return Object.fromEntries(
      ["src", "utm_source", "utm_medium", "utm_campaign"].flatMap((k) => (p.get(k) ? [[k, p.get(k)!]] : [])),
    );
  } catch {
    return {};
  }
}

export async function POST(requete: Request) {
  await connection();
  const type = requete.headers.get("content-type") ?? "";
  const modeJs = type.includes("application/json");

  const echec = (erreur: Erreur, extra: { formulaire?: string; champs?: string[] } = {}) => {
    if (modeJs) return json({ erreur, ...(extra.champs ? { champs: extra.champs } : {}) }, STATUTS[erreur]);
    const p = new URLSearchParams({ erreur });
    if (extra.formulaire) p.set("f", extra.formulaire);
    if (extra.champs?.length) p.set("champs", extra.champs.join(","));
    return vers(`/demande/confirmation?${p}`);
  };

  if (Number(requete.headers.get("content-length") ?? 0) > TAILLE_MAX) return echec("taille");
  if (!origineValide(requete.headers, configSite().SITE_URL)) {
    journal.avertissement("demande refusée : origine", { mode: modeJs ? "js" : "sans_js" });
    return echec("origine");
  }

  let brut: Record<string, unknown>;
  try {
    const texte = await requete.text();
    if (texte.length > TAILLE_MAX) return echec("taille");
    brut = modeJs
      ? (JSON.parse(texte) as Record<string, unknown>)
      : { ...sourceDepuisReferer(requete.headers), ...Object.fromEntries(new URLSearchParams(texte)) };
    if (!brut || typeof brut !== "object" || Array.isArray(brut)) throw new TypeError("objet attendu");
  } catch {
    return echec("validation", { champs: ["formulaire"] });
  }

  const v = validerDemande(brut);
  if (!v.ok) return echec("validation", { formulaire: String(brut.formulaire ?? ""), champs: v.champs });

  // Robot probable (champ piège rempli, ou envoi trop rapide) : réponse de succès
  // ordinaire, mais rien n’est enregistré ni envoyé.
  const piege = v.envoi.site_web !== "";
  const tropRapide = modeJs && v.envoi.duree !== undefined && v.envoi.duree < DELAI_MINIMAL_MS;
  if (piege || tropRapide) {
    journal.avertissement("demande ignorée : robot probable", { piege, tropRapide, type: v.demande.type });
    if (!modeJs) return vers("/#demande");
    const message = messageDemande(v.demande);
    return json({ reference: null, message, lien: lienWa((await contenuPublie()).coordonnees.whatsapp, message) });
  }

  try {
    const c = configDemandes();
    const r = await enregistrerDemande({
      demande: v.demande,
      envoi: v.envoi,
      mode: modeJs ? "js" : "sans_js",
      ip: adresseVisiteur(requete.headers, c.entete, c.proxys),
    });
    if (r.statut === "limite") return echec("limite", { formulaire: v.demande.type });

    const emailId = r.emailId;
    if (emailId !== null) {
      after(async () => {
        try {
          await envoyerEmail(emailId);
        } catch (e) {
          journal.erreur("envoi immédiat de l’e-mail impossible", { reference: r.reference, erreur: codeErreur(e) });
        }
      });
    }
    if (!modeJs) return vers(`/demande/confirmation?d=${signerConfirmation(r.reference, c.secret())}`);
    const wa = (await contenuPublie()).coordonnees.whatsapp;
    return json({ reference: r.reference, message: r.message, lien: lienWa(wa, r.message) }, r.statut === "enregistree" ? 201 : 200);
  } catch (e) {
    journal.erreur("demande non enregistrée", { type: v.demande.type, erreur: codeErreur(e) });
    return echec("serveur", { formulaire: v.demande.type });
  }
}
