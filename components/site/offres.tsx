// Sections Poulets et Fêtes (#poulets, #fetes), Professionnels (#professionnels)
// et Livraison et paiement (#livraison, #zones, #paiement, #payer).

import { Fragment } from "react";
import { dateLongue, telephoneAffiche } from "@/lib/contenu/format";
import type { ContenuPage, Icone as NomIcone } from "@/lib/contenu/types";
import { MESSAGE_FETES, MESSAGE_VIDEO, lienWa } from "@/lib/whatsapp/messages";
import { Icone } from "./icone";
import { rendu } from "./riche";

export function Poulets({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const s = c.poulets;
  const f = c.fetes;
  return (
    <section className="section section--mist" id="poulets" aria-labelledby="titre-poulets">
      <div className="container">
        <header className="intro" data-stagger="">
          <p className="label" data-reveal="left">
            <Icone id="i-home" />
            {r(s.surTitre)}
          </p>
          <h2 className="section__title" id="titre-poulets" data-reveal="">
            {r(s.titre)}
          </h2>
          <p className="section__lead" data-reveal="">
            {r(s.chapeau)}
          </p>
          <a className="btn btn--primary" href="#commande" data-demande="poulets" data-primary-cta="" data-reveal="">
            {s.bouton}
          </a>
        </header>

        {f.actif && (
          <article className="fetes" id="fetes" aria-labelledby="titre-fetes" data-reveal="scale">
            <div className="fetes__text">
              <h3 className="fetes__title" id="titre-fetes">
                {r(f.bloc.titre)}
              </h3>
              <p>
                {r(`${f.bloc.texteAvant} `)}
                <span className="fetes__garantie">{r(f.garantie)}</span>
                {r(` ${f.bloc.texteApres}`)}
              </p>
            </div>
            <div className="fetes__side">
              {/* Compte à rebours du prix garanti, écrit par le moteur après l’hydratation */}
              <p className="fetes__compte" data-fetes-compte="" aria-live="off" hidden>
                <Icone id="i-clock" />
                <span></span>
              </p>
              <ul className="fetes__dates">
                {(
                  [
                    [f.bloc.libelleClotureNoel, f.clotureNoel],
                    [f.bloc.libelleClotureNouvelAn, f.clotureNouvelAn],
                  ] as const
                ).map(([libelle, date]) => (
                  <li key={libelle}>
                    <Icone id="i-calendar" />
                    <span>
                      {`${libelle} : `}
                      <strong>{dateLongue(date)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              {/* Le message avec garantie de prix est choisi par le moteur avant la date limite */}
              <a
                className="btn btn--sun"
                id="fetes-reserver"
                href={lienWa(c.coordonnees.whatsapp, MESSAGE_FETES)}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="fetes_reserver"
                data-primary-cta=""
              >
                <Icone id="i-chat" />
                {f.bloc.bouton}
              </a>
            </div>
          </article>
        )}

        <div className="block">
          <h3 className="block__title" data-reveal="">
            {r(s.preparations.titre)}
          </h3>
          <ul className="menu-list" data-stagger="">
            {s.preparations.liste.map((p) => (
              <li className="dish" data-reveal="" key={p.nom}>
                <span className="dish__name">{p.nom}</span>
                <span className="dish__desc">{r(p.description)}</span>
                <span className="dish__price">
                  <span className="dish__from">à partir de</span>
                  {r(` ${p.prix}`)}
                </span>
              </li>
            ))}
          </ul>
          <div className="sizes" data-reveal="">
            <p>
              <strong>{r(s.preparations.calibres.titre)}</strong>
              {r(` ${s.preparations.calibres.texte}`)}
            </p>
            <p>{r(s.preparations.prixFinal)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Professionnels({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const s = c.pro;
  return (
    <section className="section" id="professionnels" aria-labelledby="titre-pro">
      <div className="container pro">
        <header className="intro pro__intro" data-stagger="">
          <p className="label" data-reveal="left">
            <Icone id="i-store" />
            {r(s.surTitre)}
          </p>
          <h2 className="section__title" id="titre-pro" data-reveal="">
            {r(s.titre)}
          </h2>
          <p className="section__lead" data-reveal="">
            {r(s.chapeau)}
          </p>
          <a className="btn btn--primary" href="#essai" data-demande="pro" data-primary-cta="" data-reveal="">
            {s.bouton}
          </a>
        </header>

        <div className="pro__side" data-reveal="">
          <h3 className="block__title">{r(s.garanties.titre)}</h3>
          <ul className="checks" data-stagger="">
            {s.garanties.elements.map((e, i) => (
              <li data-reveal="left" key={i}>
                <Icone id="i-check" />
                <span>{r(e)}</span>
              </li>
            ))}
          </ul>
          <p className="trial">
            <strong>{r(s.essai.titre)}</strong>
            {r(` ${s.essai.texte}`)}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Schéma des zones (pas à l’échelle) : dessin fixe, la liste à côté porte toute l’information. */
function SchemaZones() {
  return (
    <div className="zones__map" aria-hidden="true" data-animate="">
      <svg viewBox="0 0 380 410" className="zones__svg">
        <circle cx="190" cy="185" r="160" className="ring ring--3" />
        <circle cx="190" cy="185" r="112" className="ring ring--2" />
        <circle cx="190" cy="185" r="62" className="ring ring--1" />
        <path d="M150 242 L56 378 M230 242 L324 378" className="route" />
        <circle cx="168" cy="62" r="5" className="town" />
        <circle cx="56" cy="378" r="6" className="town" />
        <circle cx="324" cy="378" r="6" className="town" />
        <circle cx="190" cy="185" r="9" className="farm-pulse" />
        <circle cx="190" cy="185" r="9" className="farm" />
        <text x="190" y="150" className="ring-label">Bangangté</text>
        <text x="190" y="279" className="ring-label">Ndé</text>
        <text x="190" y="327" className="ring-label">Ouest</text>
        <text x="180" y="68" className="town-label is-start">Bafoussam</text>
        <text x="190" y="214" className="farm-label">La ferme</text>
        <text x="70" y="404" className="town-label">Douala</text>
        <text x="310" y="404" className="town-label">Yaoundé</text>
      </svg>
      <p className="zones__note">Schéma, pas à l’échelle</p>
    </div>
  );
}

/** Repère visuel d’une règle de paiement, d’après son cas (texte libre du contenu). */
function iconeRegle(cas: string): NomIcone {
  if (/c[ée]r[ée]monie/i.test(cas)) return "i-people";
  if (/retrait|ferme/i.test(cas)) return "i-farm";
  if (/livraison/i.test(cas)) return "i-truck";
  return "i-receipt";
}

export function Livraison({ c }: { c: ContenuPage }) {
  const { r, plat } = rendu(c);
  const s = c.livraison;
  const { paiement } = c;
  const numeros = (
    [
      ["MTN", paiement.mtn],
      ["Orange", paiement.orange],
    ] as const
  ).filter(([, n]) => n);
  return (
    <section className="section section--mist" id="livraison" aria-labelledby="titre-livraison">
      <div className="container">
        <header className="intro" data-stagger="">
          <p className="label" data-reveal="left">
            <Icone id="i-truck" />
            {r(s.surTitre)}
          </p>
          <h2 className="section__title" id="titre-livraison" data-reveal="">
            {r(s.titre)}
          </h2>
        </header>

        <div className="zones" id="zones">
          <SchemaZones />
          <ul className="zones__list" data-stagger="">
            {s.zones.map((z) => (
              <li className="zone" data-reveal="" key={z.nom}>
                <span className="zone__name">{z.nom}</span>
                <span className="visually-hidden">&nbsp;: </span>
                <span className="zone__rule">{r(z.regle)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="split split--even">
          <p className="note" data-reveal="">
            {r(s.note)}
          </p>
          <div data-reveal="">
            <h3 className="block__title block__title--small">{r(s.minimums.titre)}</h3>
            <p>{r(s.minimums.texte)}</p>
          </div>
        </div>

        <div className="block" id="paiement">
          <h3 className="block__title" data-reveal="">
            {r(s.paiement.titre)}
          </h3>
          <dl className="rules" data-reveal="">
            {s.paiement.regles.map((regle, i) => (
              <div className="rule" key={i}>
                <dt>
                  <Icone id={iconeRegle(plat(regle.cas))} classe="icon rule__icon" />
                  <span>{r(regle.cas)}</span>
                </dt>
                <dd>{r(regle.regle)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="block">
          <h3 className="block__title" data-reveal="">
            {r(s.annulation.titre)}
          </h3>
          <ol className="cancel" data-stagger="">
            {s.annulation.paliers.map((p, i) => (
              <li className="cancel__step" data-reveal="" key={i}>
                <span className="cancel__when">
                  <span className="cancel__dot" aria-hidden="true"></span>
                  {r(p.quand)}
                </span>
                <span className="cancel__what">{r(p.quoi)}</span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="safe" id="payer" aria-labelledby="titre-payer" data-reveal="">
          <Icone id="i-shield" classe="icon safe__icon" />
          <div className="safe__body">
            <h3 className="safe__title" id="titre-payer">
              {r(s.securite.titre)}
            </h3>
            {/* Nom du compte vide dans la maquette : phrase générique ; renseigné, la phrase qui le cite. */}
            <p>{r(paiement.nomCompte ? s.securite.moyensAvecCompte : s.securite.moyens)}</p>
            {numeros.length > 0 && (
              <p>
                {numeros.map(([operateur, numero], i) => (
                  <Fragment key={operateur}>
                    {`${i > 0 ? " · " : ""}${operateur} : `}
                    <span className="tel">{telephoneAffiche(numero)}</span>
                  </Fragment>
                ))}
              </p>
            )}
            <p className="safe__rule">{r(s.securite.regle)}</p>
            <p>{r(s.securite.conseils)}</p>
            <p>{r(s.securite.numero)}</p>
            <a
              className="btn btn--secondary"
              href={lienWa(c.coordonnees.whatsapp, MESSAGE_VIDEO)}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="pay_video"
            >
              <Icone id="i-video" />
              {s.securite.bouton}
              <span className="visually-hidden"> (WhatsApp)</span>
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
