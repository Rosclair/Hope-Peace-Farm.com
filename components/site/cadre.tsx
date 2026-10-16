// Cadre de la page (hors <main>) : sprite, bandeau des Fêtes, en-tête et menu,
// logo volant, pied de page, barre fixe et JSON-LD. Composants serveur : le
// moteur (lib/moteur) y attache les comportements côté navigateur.
// Le balisage suit reference/extrait/structure.html (classes, ancres, data-*).

import type { ContenuPage } from "@/lib/contenu/types";
import { lienTelephone, telephoneAffiche } from "@/lib/contenu/format";
import { SPRITE } from "@/lib/site/sprite";
import { MESSAGE_GENERAL, lienWa } from "@/lib/whatsapp/messages";
import { Icone, Logo } from "./icone";
import { rendu } from "./riche";

const NOM = "Hope & Peace Farm";

/** Liens du menu et du pied de page (libellés dans le code, liés aux ancres). */
const SECTIONS_MENU = [
  ["#ceremonies", "Cérémonies"],
  ["#poulets", "Poulets et Fêtes"],
  ["#professionnels", "Professionnels"],
  ["#livraison", "Livraison et paiement"],
  ["#la-ferme", "La ferme"],
] as const;

export function Sprite() {
  return <svg className="sprite" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: SPRITE }} />;
}

export function BandeauFetes({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  return (
    <aside className="banner" aria-label="Annonce des fêtes" aria-live="polite">
      <button type="button" className="banner__close" aria-label="Fermer l’annonce">
        <Icone id="i-close" />
      </button>
      <p className="banner__inner container">
        {" "}
        <span className="banner__text banner__text--garanti">
          {r(`${c.fetes.bandeau.annonce} ${c.fetes.garantie}`)}
        </span>{" "}
        <span className="banner__text banner__text--apres">{r(c.fetes.bandeau.annonce)}</span>{" "}
        <a href="#fetes">{c.fetes.bandeau.lien}</a>{" "}
      </p>
    </aside>
  );
}

export function EnTete({ c }: { c: ContenuPage }) {
  const waGeneral = lienWa(c.coordonnees.whatsapp, MESSAGE_GENERAL);
  return (
    <header className="header">
      <div className="header__bar container">
        <a className="brand" href="#accueil" aria-label={`${NOM}, accueil`}>
          <Logo classe="brand__logo" />
        </a>

        <nav className="nav" aria-label="Menu principal">
          <ul className="nav__list">
            {SECTIONS_MENU.map(([ancre, libelle]) => (
              <li key={ancre}>
                <a className="nav__link" href={ancre}>{libelle}</a>
              </li>
            ))}
            <li>
              <a className="nav__link" href="#questions">Questions</a>
            </li>
          </ul>
          {/* Le moteur ajuste data-demande à la section en cours ; le libellé suit en CSS
              (aucun texte modifié par script : l’hydratation reste intacte). */}
          <a className="btn btn--sun btn--small nav__cta" href="#demande" data-demande="poulets" data-cta-contexte="">
            <span className="nav__cta-texte nav__cta-texte--poulets">Commander</span>
            <span className="nav__cta-texte nav__cta-texte--ceremonie">Devis cérémonie</span>
            <span className="nav__cta-texte nav__cta-texte--pro">Essai pro</span>
          </a>

          {/* Menu mobile : <details> fonctionne sans JavaScript */}
          <details className="menu">
            <summary className="menu__toggle">
              <Icone id="i-menu" classe="icon menu__icon-open" />
              <Icone id="i-close" classe="icon menu__icon-close" />
              <span className="menu__label-open">Menu</span>
              <span className="menu__label-close">Fermer le menu</span>
            </summary>
            <div className="menu__panel">
              <ul className="menu__list">
                {SECTIONS_MENU.map(([ancre, libelle]) => (
                  <li key={ancre}>
                    <a className="menu__link" href={ancre}>{libelle}</a>
                  </li>
                ))}
                <li>
                  <a className="menu__link" href="#questions">Questions fréquentes</a>
                </li>
              </ul>
              <div className="menu__actions">
                <a className="btn btn--sun" href="#demande" data-demande="poulets" data-cta-contexte="">Faire une demande</a>
                <a className="btn btn--ghost-light" href={waGeneral} target="_blank" rel="noopener noreferrer" data-cta="menu_wa">
                  <Icone id="i-chat" />
                  WhatsApp
                </a>
              </div>
              <ul className="menu__social" aria-label="Suivre la ferme">
                <li>
                  <a href={c.coordonnees.facebook} target="_blank" rel="noopener noreferrer" data-cta="menu_facebook">
                    <Icone id="i-facebook" />
                    Facebook
                  </a>
                </li>
                <li>
                  <a href={c.coordonnees.chaineWhatsapp} target="_blank" rel="noopener noreferrer" data-cta="menu_channel">
                    <Icone id="i-channel" />
                    Chaîne WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </details>
        </nav>
      </div>
      <span className="header__progress" aria-hidden="true"></span>
    </header>
  );
}

/** Copie du logo qui vole de la landing jusqu’à l’en-tête (landing épinglée seulement). */
export function LogoVolant() {
  return (
    <div className="dock-logo" aria-hidden="true">
      <svg focusable="false">
        <use href="#logo" />
      </svg>
    </div>
  );
}

export function PiedDePage({ c, annee }: { c: ContenuPage; annee: number }) {
  const { r } = rendu(c);
  const { coordonnees: co, legal } = c;
  const waGeneral = lienWa(co.whatsapp, MESSAGE_GENERAL);
  const tel = telephoneAffiche(co.telephone);
  return (
    <footer className="footer">
      <div className="container footer__grid" data-stagger="">
        <div className="footer__brand" data-reveal="">
          <Logo classe="footer__logo" />
          <p className="footer__about">{r(c.pied.apropos)}</p>
        </div>

        <nav className="footer__col" aria-label="Pied de page" data-reveal="">
          <h2 className="footer__title">Le site</h2>
          <ul className="footer__list">
            {SECTIONS_MENU.map(([ancre, libelle]) => (
              <li key={ancre}>
                <a href={ancre}>{libelle}</a>
              </li>
            ))}
            <li>
              <a href="#questions">Questions fréquentes</a>
            </li>
          </ul>
        </nav>

        <div className="footer__col" id="nous-trouver" data-reveal="">
          <h2 className="footer__title">Nous trouver et nous joindre</h2>
          <dl className="contact">
            <div>
              <dt>WhatsApp</dt>
              <dd>
                <a href={waGeneral} target="_blank" rel="noopener noreferrer" data-cta="footer_wa">
                  <span className="tel">{telephoneAffiche(co.whatsapp)}</span>
                </a>
              </dd>
            </div>
            {co.telephone && (
              <div>
                <dt>Téléphone</dt>
                <dd>
                  <a href={lienTelephone(co.telephone)} data-cta="call">
                    <span className="tel">{tel}</span>
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt>Horaires</dt>
              <dd>{r(c.pied.horaires)}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>{co.adresse}</dd>
            </div>
          </dl>
          <ul className="social" aria-label="Suivre la ferme">
            <li>
              <a href={co.facebook} target="_blank" rel="noopener noreferrer" data-cta="footer_facebook">
                <Icone id="i-facebook" />
                <span>Facebook</span>
              </a>
            </li>
            <li>
              <a href={co.chaineWhatsapp} target="_blank" rel="noopener noreferrer" data-cta="footer_channel">
                <Icone id="i-channel" />
                <span>Chaîne WhatsApp</span>
              </a>
            </li>
          </ul>
          {/* Lien d’itinéraire : affiché seulement quand il est renseigné (vide dans la maquette). */}
          {co.lienItineraire && (
            <p>
              <a href={co.lienItineraire} target="_blank" rel="noopener noreferrer">Itinéraire</a>
            </p>
          )}
        </div>
      </div>

      <div className="container">
        <div className="footer__legal">
          <details className="legal" id="mentions-legales">
            <summary>Mentions légales</summary>
            <div className="legal__body">
              <p>
                <strong>Éditeur&nbsp;:</strong>
                {r(` ${legal.editeur}`)}
              </p>
              {/* Champs vides dans la maquette ([… à renseigner]) : la ligne reste masquée tant qu’ils manquent. */}
              {legal.responsablePublication && (
                <p>
                  <strong>Responsable de l’activité et de la publication&nbsp;:</strong>
                  {` ${legal.responsablePublication}.`}
                </p>
              )}
              <p>
                <strong>Coordonnées&nbsp;:</strong>
                {` ${co.adresse}.${co.emailContact ? ` E-mail : ${co.emailContact}.` : ""} Téléphone et WhatsApp : `}
                <span className="tel">{tel}</span>.
              </p>
              {legal.hebergeur && (
                <p>
                  <strong>Hébergeur&nbsp;:</strong>
                  {r(` ${legal.hebergeur}.`)}
                </p>
              )}
              <p>
                <strong>Propriété intellectuelle&nbsp;:</strong>
                {r(` ${legal.propriete}`)}
              </p>
            </div>
          </details>
          <details className="legal" id="confidentialite">
            <summary>Confidentialité</summary>
            <div className="legal__body">
              {c.confidentialite.paragraphes.map((p, i) => (
                <p key={i}>{r(p)}</p>
              ))}
            </div>
          </details>
          <p className="footer__copy">{`© ${annee} ${NOM}`}</p>
        </div>
      </div>
    </footer>
  );
}

/** Barre fixe (mobile) : masquée tant qu’un bouton principal ou le formulaire est visible. */
export function BarreFixe({ c }: { c: ContenuPage }) {
  return (
    <aside className="bar" aria-label="Contact rapide">
      <a
        className="btn btn--primary bar__wa"
        href={lienWa(c.coordonnees.whatsapp, MESSAGE_GENERAL)}
        target="_blank"
        rel="noopener noreferrer"
        data-cta="sticky_generic"
        aria-label={`Écrire à ${NOM} sur WhatsApp`}
      >
        <Icone id="i-chat" />
        WhatsApp
      </a>
      <a className="btn btn--secondary bar__call" href={lienTelephone(c.coordonnees.telephone)} data-cta="call" aria-label={`Appeler ${NOM}`}>
        <Icone id="i-phone" />
        Appeler
      </a>
    </aside>
  );
}

/** Données structurées LocalBusiness + WebSite (reprises du JSON-LD de la maquette). */
export function JsonLd({ c, siteUrl }: { c: ContenuPage; siteUrl: string }) {
  const url = new URL("/", siteUrl).href;
  const donnees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${url}#organization`,
        name: NOM,
        alternateName: "Hope and Peace Farm",
        url,
        description: c.seo.descriptionEntreprise,
        slogan: c.pied.signature,
        telephone: `+${c.coordonnees.telephone.replace(/\D/g, "")}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Bangangté",
          addressRegion: "Ouest",
          addressCountry: "CM",
        },
        areaServed: c.seo.zonesDesservies,
        sameAs: [c.coordonnees.facebook, c.coordonnees.chaineWhatsapp].filter(Boolean),
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: NOM,
        url,
        inLanguage: "fr",
        publisher: { "@id": `${url}#organization` },
      },
    ],
  };
  // « < » échappé : le JSON ne peut pas fermer la balise <script>.
  const json = JSON.stringify(donnees).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
