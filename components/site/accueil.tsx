// Accueil animé (landing), garanties, « Que préparez-vous ? » et « Comment ça marche ».
// Balisage de reference/extrait/structure.html ; le moteur (lib/moteur/landing.ts)
// pilote la landing épinglée par des variables CSS, sans état React.

import { Fragment } from "react";
import type { ContenuPage } from "@/lib/contenu/types";
import { MESSAGE_GENERAL, MESSAGE_VIDEO, lienWa } from "@/lib/whatsapp/messages";
import { Icone } from "./icone";
import { rendu } from "./riche";

const VB_LOGO = "103.8 94.6 816.8 816.8";

/** Un calque de l’emblème : <svg class="emblem__layer …"><use href="#lg-…"/>…</svg>. */
function Calque({ classe, calques }: { classe: string; calques: string[] }) {
  return (
    <svg className={`emblem__layer ${classe}`} viewBox={VB_LOGO} focusable="false">
      {calques.map((id) => (
        <use key={id} href={`#${id}`} />
      ))}
    </svg>
  );
}

export function Accueil({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const a = c.accueil;
  return (
    <section className="hero" id="accueil" aria-labelledby="titre-accueil">
      <div className="hero__stage">
        <div className="hero__sky" aria-hidden="true"></div>
        <div className="hero__land" aria-hidden="true">
          <svg className="land land--back" viewBox="0 0 1440 240" preserveAspectRatio="none" focusable="false">
            <path d="M0 118C170 70 330 64 520 102S880 166 1080 110 1340 66 1440 84V240H0Z" />
          </svg>
          <svg className="land land--mid" viewBox="0 0 1440 240" preserveAspectRatio="none" focusable="false">
            <path d="M0 160C220 120 430 132 640 166S1040 204 1240 160 1400 140 1440 146V240H0Z" />
          </svg>
          <svg className="land land--front" viewBox="0 0 1440 240" preserveAspectRatio="none" focusable="false">
            <path d="M0 206C240 184 480 190 720 210S1200 230 1440 198V240H0Z" />
          </svg>
        </div>

        <div className="container hero__grid">
          {/* Le logo, découpé en calques : il s’assemble au chargement (CSS seul) */}
          <div className="hero__emblem" aria-hidden="true">
            <div className="emblem">
              <Calque classe="emblem__base" calques={["lg-badge", "lg-rings"]} />
              <div className="emblem__clip">
                <Calque classe="emblem__sun" calques={["lg-sun"]} />
                <Calque classe="emblem__rays" calques={["lg-rays"]} />
                <Calque classe="emblem__hills" calques={["lg-hills"]} />
              </div>
              <Calque classe="emblem__dove" calques={["lg-branch", "lg-dove"]} />
              <Calque classe="emblem__hen" calques={["lg-chicken"]} />
              <Calque classe="emblem__ribbon" calques={["lg-banner", "lg-banner-stripes"]} />
              <Calque classe="emblem__name" calques={["lg-banner-text"]} />
              <Calque classe="emblem__motto" calques={["lg-tagline"]} />
              <Calque classe="emblem__ground" calques={["lg-hills-bottom"]} />
            </div>
          </div>

          <div className="hero__text">
            <p className="hero__kicker">{r(a.surTitre)}</p>
            <h1 className="hero__title" id="titre-accueil">
              {a.titre.map((ligne, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span>{ligne}</span>
                </Fragment>
              ))}
            </h1>
            <p className="hero__lead">{r(a.chapeau)}</p>
            <div className="hero__actions">
              <a className="btn btn--sun" href="#devis" data-demande="ceremonie" data-primary-cta="">
                {a.boutonPrincipal}
              </a>
              <a
                className="link link--light"
                href={lienWa(c.coordonnees.whatsapp, MESSAGE_GENERAL)}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="hero_wa"
              >
                <Icone id="i-chat" />
                {a.lienWhatsapp}
                <span className="visually-hidden"> (WhatsApp)</span>
              </a>
            </div>
          </div>

          {/* Exemple de suivi : sur la landing épinglée, les étapes se cochent au défilement */}
          <figure className="suivi" aria-labelledby="suivi-titre" data-animate="">
            <figcaption className="suivi__head">
              <span className="suivi__tag">{a.suivi.etiquette}</span>
              <span className="suivi__title" id="suivi-titre">{a.suivi.titre}</span>
              <span className="suivi__meta">{r(a.suivi.detail)}</span>
            </figcaption>
            <ol className="suivi__steps">
              {a.suivi.etapes.map((e, i) => (
                <li className="suivi__step" key={i}>
                  <span className="suivi__dot">
                    <Icone id="i-check" />
                  </span>
                  <span className="suivi__what">{r(e.quoi)}</span>
                  <span className="suivi__when">{e.quand}</span>
                </li>
              ))}
            </ol>
            <p className="suivi__foot">{r(a.suivi.pied)}</p>
          </figure>
        </div>

        <p className="hero__hint" aria-hidden="true">
          <span>Faites défiler</span>
          <Icone id="i-chevron" masquee={false} />
        </p>
      </div>
    </section>
  );
}

export function Garanties({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  return (
    <section className="assurance" aria-labelledby="titre-garanties">
      <div className="container">
        <h2 className="assurance__title" id="titre-garanties" data-reveal="">
          {r(c.garanties.titre)}
        </h2>
        <ul className="trust" data-stagger="">
          {c.garanties.elements.map((g, i) => (
            <li className="trust__item" data-reveal="" key={i}>
              <Icone id={g.icone} />
              {r(g.texte)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PORTES = [
  { cle: "ceremonie", ancre: "#ceremonies", icone: "i-people" },
  { cle: "maison", ancre: "#poulets", icone: "i-home" },
  { cle: "pro", ancre: "#professionnels", icone: "i-store" },
] as const;

export function Portes({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  return (
    <section className="section" aria-labelledby="titre-choix">
      <div className="container">
        <h2 className="section__title" id="titre-choix" data-reveal="">
          {r(c.choix.titre)}
        </h2>
        <ul className="doors" data-stagger="">
          {PORTES.map(({ cle, ancre, icone }) => {
            const p = c.choix.portes[cle];
            return (
              <li data-reveal="" key={cle}>
                <a className="door" href={ancre}>
                  <Icone id={icone} classe="icon door__icon" />
                  <span className="door__body">
                    <span className="door__title">{p.titre}</span>
                    <span className="door__text">{r(p.texte)}</span>
                    {p.prix && <span className="door__price">{r(p.prix)}</span>}
                  </span>
                  <Icone id="i-arrow" classe="icon door__arrow" />
                </a>
              </li>
            );
          })}
        </ul>
        <p className="abroad" data-reveal="">
          {r(`${c.choix.etranger.question} `)}
          <a
            className="link"
            href={lienWa(c.coordonnees.whatsapp, MESSAGE_VIDEO)}
            target="_blank"
            rel="noopener noreferrer"
            data-cta="home_video"
          >
            <Icone id="i-video" />
            {c.choix.etranger.lien}
            <span className="visually-hidden"> (WhatsApp)</span>
          </a>
        </p>
      </div>
    </section>
  );
}

export function Deroule({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  return (
    <section className="section section--mist" aria-labelledby="titre-marche">
      <div className="container">
        <h2 className="section__title" id="titre-marche" data-reveal="">
          {r(c.deroule.titre)}
        </h2>
        <ol className="flow" data-animate="">
          {c.deroule.etapes.map((e, i) => (
            <li className="flow__step" key={i}>
              <span className="flow__num" aria-hidden="true">
                {i + 1}
              </span>
              <p>{r(e)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
