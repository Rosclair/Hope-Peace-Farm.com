// Page de confirmation d’une demande envoyée sans JavaScript (architecture §6) :
// même vue de succès que le formulaire (message de la maquette suivi de la
// référence, bouton « Ouvrir WhatsApp et envoyer »), ou explication d’un échec.
// Jamais en cache, jamais indexée. L’adresse ne contient aucune donnée personnelle :
// un jeton signé, valable 30 minutes, qui porte seulement la référence.

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Sprite } from "@/components/site/cadre";
import { Icone } from "@/components/site/icone";
import { configDemandes } from "@/lib/config";
import { telephoneAffiche } from "@/lib/contenu/format";
import { contenuPublie } from "@/lib/contenu/lecture";
import { lireConfirmation } from "@/lib/demandes/jeton";
import { db } from "@/lib/db/client";
import { demande } from "@/lib/db/schema";
import { lienWa, MESSAGE_COMMANDE, texteRemerciement, type TypeDemande } from "@/lib/whatsapp/messages";
import "@/app/maquette.css";
import "@/app/site.css";

/**
 * Rendu en entier à la requête, sans coquille statique : cette page sert les visiteurs
 * sans JavaScript, qui ne verraient jamais un contenu arrivé en flux derrière <Suspense>
 * (il reste dans un bloc masqué jusqu’à ce qu’un script l’insère).
 */
export const instant = false;

export const metadata: Metadata = {
  title: "Votre demande — Hope & Peace Farm",
  robots: { index: false, follow: false },
};

/** Libellés des champs, pour dire lesquels corriger. */
const LIBELLES: Record<string, string> = {
  ceremonie: "Type de cérémonie",
  date: "Date",
  lieu: "Lieu",
  invites: "Nombre d’invités",
  nom: "Prénom et nom",
  residence: "Où habitez-vous ?",
  nombre: "Nombre de poulets",
  preparation: "Préparation",
  reception: "Réception",
  etablissement: "Nom de l’établissement",
  type: "Type d’établissement",
  ville: "Ville et quartier",
  volume: "Volume par semaine",
  contact: "Nom et fonction du contact",
  precisions: "Précisions",
  whatsapp: "Numéro WhatsApp",
  consentement: "Accord pour être contacté sur WhatsApp",
  formulaire: "Formulaire",
};

type Parametres = { [cle: string]: string | string[] | undefined };
const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Succes({ reference }: { reference: string }) {
  const c = await contenuPublie();
  const [d] = await db()
    .select({ type: demande.type, nom: demande.nom, message: demande.message, reponses: demande.reponses })
    .from(demande)
    .where(eq(demande.reference, reference))
    .limit(1);
  if (!d) return <Echec titre="Demande introuvable" texte="Cette demande n’existe plus." wa={c.coordonnees.whatsapp} />;
  const reponses = (d.reponses ?? {}) as Record<string, unknown>;
  const telephone = telephoneAffiche(c.coordonnees.whatsapp);
  return (
    <div className="done">
      <h2 className="done__title">Votre message est prêt</h2>
      <p className="done__text">{texteRemerciement(d.type as TypeDemande, { nom: d.nom })}</p>
      {d.type === "ceremonie" && reponses.ceremonie === "funerailles" && (
        <p className="done__text">
          Toutes nos condoléances. Nous nous occupons de l’essentiel pour que vous puissiez vous consacrer à votre famille.
        </p>
      )}
      <blockquote className="done__message">{d.message}</blockquote>
      <div className="done__actions">
        <a className="btn btn--primary" href={lienWa(c.coordonnees.whatsapp, d.message)} target="_blank" rel="noopener noreferrer">
          <Icone id="i-chat" />
          Ouvrir WhatsApp et envoyer
        </a>
      </div>
      <p className="done__help">
        Votre demande est enregistrée sous la référence <strong>{reference}</strong>. Si WhatsApp ne s’ouvre pas&nbsp;: appuyez
        longuement sur le message pour le copier, et envoyez-le au <strong className="tel">{telephone}</strong>.
      </p>
    </div>
  );
}

function Echec({ titre, texte, liste, wa }: { titre: string; texte: string; liste?: string[]; wa: string }) {
  return (
    <div className="done">
      <h2 className="done__title">{titre}</h2>
      <p className="done__text">{texte}</p>
      {liste && liste.length > 0 && (
        <ul className="confirmation__liste">
          {liste.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div className="done__actions confirmation__actions">
        <a className="btn btn--primary" href={lienWa(wa, MESSAGE_COMMANDE)} target="_blank" rel="noopener noreferrer">
          <Icone id="i-chat" />
          Écrire sur WhatsApp
        </a>
        <a className="btn btn--secondary" href="/#demande">
          Revenir au formulaire
        </a>
      </div>
    </div>
  );
}

async function Resultat({ parametres }: { parametres: Promise<Parametres> }) {
  const p = await parametres;
  const jeton = un(p.d);
  if (jeton) {
    const reference = lireConfirmation(jeton, configDemandes().secret());
    if (reference) return <Succes reference={reference} />;
  }
  const { coordonnees } = await contenuPublie();
  const wa = coordonnees.whatsapp;
  const erreur = un(p.erreur);
  if (erreur === "validation") {
    const champs = (un(p.champs) ?? "").split(",").flatMap((ch) => (LIBELLES[ch] ? [LIBELLES[ch]!] : []));
    return (
      <Echec
        titre="Quelques champs sont à corriger"
        texte={"Revenez en arrière avec le bouton de votre navigateur : votre saisie y est encore. Vérifiez ces champs :"}
        liste={champs}
        wa={wa}
      />
    );
  }
  if (erreur === "limite") {
    return (
      <Echec
        titre="Demande non enregistrée"
        texte="Plusieurs demandes viennent déjà d’être envoyées depuis ce numéro ou cette connexion. Écrivez-nous directement sur WhatsApp, nous vous répondons."
        wa={wa}
      />
    );
  }
  if (erreur) {
    return (
      <Echec
        titre="Demande non enregistrée"
        texte="Votre demande n’a pas pu nous parvenir par le site. Écrivez-nous directement sur WhatsApp, ou réessayez dans un moment."
        wa={wa}
      />
    );
  }
  return (
    <Echec
      titre="Lien expiré"
      texte="Ce lien de confirmation n’est plus valable (30 minutes). Si vous avez noté la référence de votre demande, elle est bien enregistrée. Sinon, écrivez-nous sur WhatsApp."
      wa={wa}
    />
  );
}

export default function PageConfirmation({ searchParams }: { searchParams: Promise<Parametres> }) {
  return (
    <>
      <Sprite />
      <main className="request confirmation" id="contenu">
        <div className="container request__grid">
          <header className="request__head">
            <h1 className="request__title">Votre demande</h1>
            <p className="request__lead">
              <a className="link link--light" href="/">
                Revenir à Hope &amp; Peace Farm
              </a>
            </p>
          </header>
          <div className="request__card">
            <Resultat parametres={searchParams} />
          </div>
        </div>
      </main>
    </>
  );
}
