// Section « Votre demande » (#demande, #devis, #commande, #essai) : onglets et trois
// formulaires en deux étapes, rendus côté serveur. Le moteur (lib/moteur/demande.ts)
// y attache onglets, étapes, validation, brouillon, compteur et vue de succès, comme
// la maquette. Libellés, aides et messages restent dans le code (mesure et tests).
// Phase 4 : numéro WhatsApp, consentement, envoi au serveur et envoi sans JavaScript.

import type { ReactNode } from "react";
import { lienTelephone, telephoneAffiche } from "@/lib/contenu/format";
import type { ContenuPage } from "@/lib/contenu/types";
import { MESSAGE_COMMANDE, lienWa } from "@/lib/whatsapp/messages";
import { Icone } from "./icone";
import { rendu } from "./riche";

function Erreur() {
  return <p className="field__error" hidden></p>;
}

function Puces({ nom, options }: { nom: string; options: [string, ReactNode][] }) {
  return (
    <div className="chips">
      {options.map(([valeur, libelle], i) => (
        <label className="chip" key={valeur}>
          <input type="radio" name={nom} value={valeur} required={i === 0} />
          <span>{libelle}</span>
        </label>
      ))}
    </div>
  );
}

function Progression() {
  return (
    <>
      <div className="progress">
        <p className="progress__text" aria-live="polite">
          Étape <span data-step-now="">1</span> sur <span data-step-total="">2</span>
        </p>
        <span className="progress__bar" aria-hidden="true">
          <span></span>
        </span>
      </div>
      <div className="errors" role="alert" hidden>
        <p>Vérifiez ces champs&nbsp;:</p>
        <ul></ul>
      </div>
    </>
  );
}

function Annonces() {
  return (
    <label className="check">
      <input type="checkbox" name="annonces" value="1" />
      <span>J’accepte de recevoir les annonces de Hope &amp; Peace Farm (facultatif&nbsp;; deux messages par mois au plus).</span>
    </label>
  );
}

function Navigation({ envoyer }: { envoyer: string }) {
  return (
    <div className="rform__nav">
      <button className="btn btn--primary" type="submit">
        {envoyer}
      </button>
      <button className="btn btn--text" type="button" data-prev="">
        Retour
      </button>
    </div>
  );
}

function Continuer() {
  return (
    <div className="rform__nav">
      <button className="btn btn--primary" type="button" data-next="">
        Continuer
      </button>
    </div>
  );
}

function Succes({ telephone, condoleances = false }: { telephone: string; condoleances?: boolean }) {
  return (
    <div className="done" hidden>
      <h3 className="done__title" tabIndex={-1}>
        Votre message est prêt
      </h3>
      <p className="done__text" data-done-text=""></p>
      {condoleances && (
        <p className="done__text" data-done-extra="" hidden>
          Toutes nos condoléances. Nous nous occupons de l’essentiel pour que vous puissiez vous consacrer à votre famille.
        </p>
      )}
      <blockquote className="done__message" data-done-message=""></blockquote>
      <div className="done__actions">
        <a className="btn btn--primary" data-done-wa="" href="#" target="_blank" rel="noopener noreferrer">
          <Icone id="i-chat" />
          Ouvrir WhatsApp et envoyer
        </a>
        <button className="btn btn--secondary" type="button" data-copy="">
          <Icone id="i-copy" />
          <span>Copier le message</span>
        </button>
      </div>
      <p className="done__help">
        Si WhatsApp ne s’ouvre pas&nbsp;: copiez le message et envoyez-le au <strong className="tel">{telephone}</strong>. Dans le
        navigateur de Facebook ou d’Instagram, ouvrez le menu puis «&nbsp;Ouvrir dans le navigateur&nbsp;».
      </p>
      <textarea className="input input--area done__fallback" readOnly hidden aria-label="Message à copier"></textarea>
      <button className="btn btn--text" type="button" data-edit="">
        Modifier ma demande
      </button>
    </div>
  );
}

function Intro({ c, type }: { c: ContenuPage; type: keyof ContenuPage["demande"]["formulaires"] }) {
  const { r } = rendu(c);
  const f = c.demande.formulaires[type];
  return (
    <div className="rform__intro">
      <h3 className="rform__title">{r(f.titre)}</h3>
      <p>{r(f.texte)}</p>
    </div>
  );
}

function FormulaireCeremonie({ c, telephone }: { c: ContenuPage; telephone: string }) {
  return (
    <form className="rform is-current" data-form="ceremonie" method="post" noValidate>
      <Intro c={c} type="ceremonie" />
      <Progression />

      <div className="rstep is-active" data-step="1">
        <h4 className="rstep__title" tabIndex={-1}>
          La cérémonie
        </h4>
        <fieldset className="field" data-field="ceremonie">
          <legend className="field__label">Type de cérémonie</legend>
          <Puces
            nom="ceremonie"
            options={[
              ["funerailles", "Funérailles"],
              ["mariage", "Mariage"],
              ["dot", "Dot"],
              ["bapteme", "Baptême"],
              ["retour", "Retour au village"],
              ["autre", "Autre"],
            ]}
          />
          <Erreur />
        </fieldset>
        <div className="field" data-field="date">
          <label className="field__label" htmlFor="c-date">
            Date
          </label>
          <input className="input" id="c-date" name="date" type="date" required data-date="" />
          <label className="check check--inline">
            <input type="checkbox" name="date_inconnue" value="1" />
            <span>La date n’est pas encore fixée</span>
          </label>
          <Erreur />
        </div>
        <div className="field" data-field="lieu">
          <label className="field__label" htmlFor="c-lieu">
            Lieu
          </label>
          <p className="field__hint" id="c-lieu-aide">
            Village, chefferie ou quartier, et un point de repère
          </p>
          <input
            className="input"
            id="c-lieu"
            name="lieu"
            type="text"
            maxLength={140}
            autoComplete="off"
            enterKeyHint="next"
            aria-describedby="c-lieu-aide"
            required
          />
          <Erreur />
        </div>
        <fieldset className="field" data-field="invites">
          <legend className="field__label">Nombre d’invités (approximatif)</legend>
          <Puces
            nom="invites"
            options={[
              ["moins de 100", "Moins de 100"],
              ["100 à 200", "100 à 200"],
              ["200 à 400", "200 à 400"],
              ["plus de 400", "Plus de 400"],
            ]}
          />
          <Erreur />
        </fieldset>
        <Continuer />
      </div>

      <div className="rstep" data-step="2">
        <h4 className="rstep__title" tabIndex={-1}>
          Vos coordonnées
        </h4>
        <div className="field" data-field="nom">
          <label className="field__label" htmlFor="c-nom">
            Prénom et nom
          </label>
          <input className="input" id="c-nom" name="nom" type="text" maxLength={80} autoComplete="name" enterKeyHint="next" required />
          <Erreur />
        </div>
        <div className="field" data-field="residence">
          <label className="field__label" htmlFor="c-residence">
            Où habitez-vous&nbsp;?
          </label>
          <p className="field__hint" id="c-residence-aide">
            Ville ou pays
          </p>
          <input
            className="input"
            id="c-residence"
            name="residence"
            type="text"
            maxLength={80}
            autoComplete="address-level2"
            enterKeyHint="next"
            aria-describedby="c-residence-aide"
            required
          />
          <Erreur />
        </div>
        <details className="more">
          <summary>Ajouter une précision</summary>
          <label className="field__label" htmlFor="c-precisions">
            Précisions (facultatif)
          </label>
          <p className="field__hint" id="c-precisions-aide">
            Poulets, chèvres, autres produits, préparation, livraison… dites-nous ce que vous savez.
          </p>
          <textarea
            className="input input--area"
            id="c-precisions"
            name="precisions"
            maxLength={300}
            rows={3}
            aria-describedby="c-precisions-aide"
          ></textarea>
        </details>
        <Annonces />
        <Navigation envoyer="Demander mon devis cérémonie" />
      </div>

      <Succes telephone={telephone} condoleances />
    </form>
  );
}

function FormulairePoulets({ c, telephone }: { c: ContenuPage; telephone: string }) {
  return (
    <form className="rform" data-form="poulets" method="post" noValidate>
      <Intro c={c} type="poulets" />
      <Progression />

      <div className="rstep is-active" data-step="1">
        <h4 className="rstep__title" tabIndex={-1}>
          Votre commande
        </h4>
        <div className="field" data-field="nombre">
          <label className="field__label" htmlFor="p-nombre">
            Nombre de poulets
          </label>
          <div className="counter">
            <button className="counter__btn" type="button" data-count="-1" aria-label="Un poulet de moins">
              −
            </button>
            <input
              className="input counter__input"
              id="p-nombre"
              name="nombre"
              type="text"
              inputMode="numeric"
              pattern="[1-9][0-9]{0,3}"
              maxLength={4}
              autoComplete="off"
              enterKeyHint="next"
              required
            />
            <button className="counter__btn" type="button" data-count="1" aria-label="Un poulet de plus">
              +
            </button>
          </div>
          <Erreur />
        </div>
        <fieldset className="field" data-field="preparation">
          <legend className="field__label">Préparation</legend>
          <Puces
            nom="preparation"
            options={[
              ["vivant", "Vivant"],
              ["pret", "Prêt à cuire"],
              ["sauce", <>Découpé sauce <small>(10 à 12 morceaux)</small></>],
              ["braise", <>Découpé braise <small>(ouvert ou en 4)</small></>],
            ]}
          />
          <Erreur />
        </fieldset>
        <div className="field" data-field="date">
          <label className="field__label" htmlFor="p-date">
            Date souhaitée
          </label>
          <p className="field__hint" id="p-date-aide">
            Nous confirmons la disponibilité
          </p>
          <input className="input" id="p-date" name="date" type="date" aria-describedby="p-date-aide" required data-date="" />
          <Erreur />
        </div>
        <Continuer />
      </div>

      <div className="rstep" data-step="2">
        <h4 className="rstep__title" tabIndex={-1}>
          Réception
        </h4>
        <fieldset className="field" data-field="reception">
          <legend className="field__label">Réception</legend>
          <Puces
            nom="reception"
            options={[
              ["retrait", "Retrait à la ferme"],
              ["livraison", "Livraison"],
            ]}
          />
          <Erreur />
        </fieldset>
        <div className="field field--livraison" data-field="lieu">
          <label className="field__label" htmlFor="p-lieu">
            Lieu de livraison
          </label>
          <p className="field__hint" id="p-lieu-aide">
            Ville, quartier, point de repère
          </p>
          <input
            className="input"
            id="p-lieu"
            name="lieu"
            type="text"
            maxLength={120}
            autoComplete="off"
            enterKeyHint="next"
            aria-describedby="p-lieu-aide"
          />
          <Erreur />
        </div>
        <div className="field" data-field="nom">
          <label className="field__label" htmlFor="p-nom">
            Prénom et nom
          </label>
          <input className="input" id="p-nom" name="nom" type="text" maxLength={80} autoComplete="name" enterKeyHint="next" required />
          <Erreur />
        </div>
        <details className="more">
          <summary>Ajouter une précision</summary>
          <label className="field__label" htmlFor="p-precisions">
            Précision (facultatif)
          </label>
          <textarea className="input input--area" id="p-precisions" name="precisions" maxLength={300} rows={3}></textarea>
        </details>
        <Annonces />
        <Navigation envoyer="Envoyer ma demande sur WhatsApp" />
      </div>

      <Succes telephone={telephone} />
    </form>
  );
}

function FormulairePro({ c, telephone }: { c: ContenuPage; telephone: string }) {
  return (
    <form className="rform" data-form="pro" method="post" noValidate>
      <Intro c={c} type="pro" />
      <Progression />

      <div className="rstep is-active" data-step="1">
        <h4 className="rstep__title" tabIndex={-1}>
          Votre établissement
        </h4>
        <div className="field" data-field="etablissement">
          <label className="field__label" htmlFor="e-nom">
            Nom de l’établissement
          </label>
          <input
            className="input"
            id="e-nom"
            name="etablissement"
            type="text"
            maxLength={100}
            autoComplete="organization"
            enterKeyHint="next"
            required
          />
          <Erreur />
        </div>
        <fieldset className="field" data-field="type">
          <legend className="field__label">Type d’établissement</legend>
          <Puces
            nom="type"
            options={[
              ["restaurant", "Restaurant"],
              ["snack ou braiseur", "Snack ou braiseur"],
              ["hôtel", "Hôtel"],
              ["traiteur", "Traiteur"],
              ["cantine ou internat", "Cantine ou internat"],
              ["autre", "Autre"],
            ]}
          />
          <Erreur />
        </fieldset>
        <div className="field" data-field="ville">
          <label className="field__label" htmlFor="e-ville">
            Ville et quartier
          </label>
          <input
            className="input"
            id="e-ville"
            name="ville"
            type="text"
            maxLength={80}
            autoComplete="address-level2"
            enterKeyHint="next"
            required
          />
          <Erreur />
        </div>
        <Continuer />
      </div>

      <div className="rstep" data-step="2">
        <h4 className="rstep__title" tabIndex={-1}>
          Votre besoin
        </h4>
        <fieldset className="field" data-field="volume">
          <legend className="field__label">Volume par semaine</legend>
          <Puces
            nom="volume"
            options={[
              ["moins de 10", "Moins de 10"],
              ["10 à 30", "10 à 30"],
              ["30 à 60", "30 à 60"],
              ["plus de 60", "Plus de 60 poulets"],
            ]}
          />
          <Erreur />
        </fieldset>
        <fieldset className="field" data-field="preparation">
          <legend className="field__label">Préparation</legend>
          <Puces
            nom="preparation"
            options={[
              ["vivants", "Vivant"],
              ["prêts à cuire", "Prêt à cuire"],
              ["découpés", "Découpé"],
            ]}
          />
          <Erreur />
        </fieldset>
        <div className="field" data-field="contact">
          <label className="field__label" htmlFor="e-contact">
            Nom et fonction du contact
          </label>
          <input
            className="input"
            id="e-contact"
            name="contact"
            type="text"
            maxLength={80}
            autoComplete="name"
            enterKeyHint="next"
            required
          />
          <Erreur />
        </div>
        <details className="more">
          <summary>Ajouter une précision</summary>
          <label className="field__label" htmlFor="e-precisions">
            Précisions (facultatif)
          </label>
          <p className="field__hint" id="e-precisions-aide">
            Calibre, jours de livraison souhaités, mode de paiement, date de début
          </p>
          <textarea
            className="input input--area"
            id="e-precisions"
            name="precisions"
            maxLength={300}
            rows={3}
            aria-describedby="e-precisions-aide"
          ></textarea>
        </details>
        <Navigation envoyer="Demander une livraison d’essai" />
      </div>

      <Succes telephone={telephone} />
    </form>
  );
}

export function Demande({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const s = c.demande;
  const telephone = telephoneAffiche(c.coordonnees.whatsapp);
  return (
    <section className="request" id="demande" aria-labelledby="titre-demande">
      <span id="devis" className="anchor"></span>
      <span id="commande" className="anchor"></span>
      <span id="essai" className="anchor"></span>
      <div className="container request__grid">
        <header className="request__head" data-stagger="">
          <h2 className="request__title" id="titre-demande" data-reveal="">
            {r(s.titre)}
          </h2>
          <p className="request__lead" data-reveal="">
            {r(s.chapeau)}
          </p>
          <ol className="request__next" data-reveal="">
            {s.etapes.map((e, i) => (
              <li key={i}>{r(e)}</li>
            ))}
          </ol>
          <div className="request__direct" data-reveal="">
            <a
              className="btn btn--sun"
              href={lienWa(c.coordonnees.whatsapp, MESSAGE_COMMANDE)}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="home_final"
              data-primary-cta=""
            >
              <Icone id="i-chat" />
              {s.boutonWhatsapp}
            </a>
            <a className="link link--light" href={lienTelephone(c.coordonnees.telephone)} data-cta="call">
              <Icone id="i-phone" />
              {s.boutonAppel}
            </a>
          </div>
        </header>

        <div className="request__card" data-reveal="">
          <noscript>
            <p className="noscript">
              Le formulaire a besoin de JavaScript. Écrivez-nous directement sur WhatsApp au <strong>{telephone}</strong>&nbsp;: indiquez
              la quantité, la préparation, la date et le lieu.
            </p>
          </noscript>

          <fieldset className="tabs">
            <legend className="tabs__legend">Votre demande concerne</legend>
            <div className="tabs__row">
              {(
                [
                  ["ceremonie", "Cérémonie"],
                  ["poulets", "Poulets"],
                  ["pro", "Pro"],
                ] as const
              ).map(([valeur, libelle], i) => (
                <label className="tab" key={valeur}>
                  <input type="radio" name="type-demande" value={valeur} defaultChecked={i === 0} />
                  <span>{libelle}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <FormulaireCeremonie c={c} telephone={telephone} />
          <FormulairePoulets c={c} telephone={telephone} />
          <FormulairePro c={c} telephone={telephone} />

          <p className="request__privacy">
            {r(`${s.confidentialite} `)}
            <a href="#confidentialite" data-open-details="">
              Confidentialité
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
