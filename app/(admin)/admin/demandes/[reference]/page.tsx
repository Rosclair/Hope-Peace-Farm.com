import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cadre } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { estARelancer, libelleReponse, LIBELLES_STATUT, LIBELLES_TYPE, lireDemande, sourceDe, valeurReponse } from "@/lib/admin/demandes";
import { dateHeure, depuis, numeroAffiche } from "@/lib/admin/format";
import { exigerCompte } from "@/lib/auth/session";
import { STATUTS_DEMANDE } from "@/lib/db/schema";
import { ajouterNote, corriger, ecrireWhatsapp, modifierStatut } from "../actions";

export const metadata: Metadata = { title: "Demande" };

const TYPES_EVENEMENT: Record<string, string> = {
  creation: "Demande reçue",
  statut: "Statut",
  note: "Note interne",
  contact_whatsapp: "Écrit sur WhatsApp",
  correction: "Correction",
};

export default async function PageDemande({ params }: { params: Promise<{ reference: string }> }) {
  const compte = await exigerCompte();
  const { reference } = await params;
  if (!/^HP-\d{6}-[A-Z0-9]{6}$/.test(reference)) notFound();
  const d = await lireDemande(reference);
  if (!d) notFound();
  const reponses = Object.entries(d.reponses).filter(([, v]) => v !== "" && v !== false && v !== null && v !== undefined);

  return (
    <Cadre compte={compte} rubrique="demandes">
      <p>
        <Link href="/admin/demandes">← Toutes les demandes</Link>
      </p>
      <h1>
        {d.nom} · {LIBELLES_TYPE[d.type]}
      </h1>
      <p className="ligne">
        <span>
          {d.reference} · reçue le {dateHeure(d.creeLe)}
        </span>
        <span className={`pastille pastille--${d.statut}`}>{LIBELLES_STATUT[d.statut]}</span>
      </p>
      {estARelancer(d) && (
        <p className="message message--attention">À relancer&nbsp;: statut inchangé depuis {depuis(d.statutChangeLe).replace("il y a ", "")}.</p>
      )}

      <section className="carte" aria-labelledby="t-contact">
        <h2 id="t-contact">Contact</h2>
        <p>
          WhatsApp&nbsp;: <strong className="tel">{numeroAffiche(d.whatsappE164)}</strong>
        </p>
        <form action={ecrireWhatsapp}>
          <input type="hidden" name="reference" value={d.reference} />
          <button className="btn" type="submit">
            Écrire sur WhatsApp
          </button>
        </form>
        <p className="discret">
          Accord pour être contacté sur WhatsApp donné le {dateHeure(d.consentementContactLe)} (texte du {d.consentementVersion}). Annonces&nbsp;:{" "}
          {d.annonces ? "acceptées" : "non"}.
        </p>
      </section>

      <section className="carte" aria-labelledby="t-reponses">
        <h2 id="t-reponses">Demande</h2>
        <dl>
          {reponses.map(([k, v]) => (
            <div key={k} className="ligne">
              <dt className="discret">{libelleReponse(k)}</dt>
              <dd>{valeurReponse(k, v)}</dd>
            </div>
          ))}
        </dl>
        <h3>Message proposé au client</h3>
        <blockquote className="rendu">{d.message}</blockquote>
        <p className="discret">
          Source&nbsp;: {sourceDe(d)}
          {d.utmMedium ? ` · ${d.utmMedium}` : ""}
          {d.utmCampaign ? ` · ${d.utmCampaign}` : ""} · envoi {d.modeEnvoi === "js" ? "par le formulaire" : "sans JavaScript"}
        </p>
      </section>

      <section className="carte" aria-labelledby="t-statut">
        <h2 id="t-statut">Statut</h2>
        <Formulaire action={modifierStatut} bouton="Enregistrer le statut">
          <input type="hidden" name="reference" value={d.reference} />
          <div className="champ">
            <label htmlFor="statut">Nouveau statut</label>
            <select id="statut" name="statut" defaultValue={d.statut}>
              {STATUTS_DEMANDE.map((s) => (
                <option key={s} value={s}>
                  {LIBELLES_STATUT[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="statut-texte">Commentaire (facultatif)</label>
            <input id="statut-texte" name="texte" type="text" maxLength={1000} />
          </div>
        </Formulaire>
      </section>

      <section className="carte" aria-labelledby="t-note">
        <h2 id="t-note">Note interne</h2>
        <Formulaire action={ajouterNote} bouton="Ajouter la note">
          <input type="hidden" name="reference" value={d.reference} />
          <div className="champ">
            <label htmlFor="note">Note (visible seulement dans le back-office)</label>
            <textarea id="note" name="texte" maxLength={2000} required />
          </div>
        </Formulaire>
      </section>

      <section className="carte" aria-labelledby="t-historique">
        <h2 id="t-historique">Historique</h2>
        <ol className="historique">
          {d.evenements.map((e) => (
            <li key={e.id}>
              <strong>{TYPES_EVENEMENT[e.type] ?? e.type}</strong>
              {e.type === "statut" && e.versStatut
                ? ` : ${e.deStatut ? `${LIBELLES_STATUT[e.deStatut]} → ` : ""}${LIBELLES_STATUT[e.versStatut]}`
                : ""}
              <div className="discret">
                {dateHeure(e.creeLe)}
                {e.auteur ? ` · ${e.auteur}` : ""}
              </div>
              {e.texte && <p>{e.texte}</p>}
            </li>
          ))}
        </ol>
      </section>

      <details className="carte">
        <summary>Corriger le nom ou le numéro (à la demande du client)</summary>
        <Formulaire action={corriger} bouton="Enregistrer la correction" boutonClasse="btn btn--second">
          <input type="hidden" name="reference" value={d.reference} />
          <div className="champ">
            <label htmlFor="c-nom">Nom</label>
            <input id="c-nom" name="nom" type="text" defaultValue={d.nom} maxLength={100} required />
          </div>
          <div className="champ">
            <label htmlFor="c-whatsapp">Numéro WhatsApp</label>
            <input id="c-whatsapp" name="whatsapp" type="tel" defaultValue={d.whatsappE164} maxLength={40} required />
          </div>
        </Formulaire>
      </details>

      <p>
        <Link className="btn btn--danger" href={`/admin/demandes/supprimer?ref=${d.reference}`}>
          Supprimer les données de ce client
        </Link>
      </p>
    </Cadre>
  );
}
