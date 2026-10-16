// Sections La ferme (#la-ferme, #engagements) et Questions fréquentes (#questions).
// Promoteur, galerie et avis : vides au départ, blocs masqués (phase 6).

import type { ContenuPage } from "@/lib/contenu/types";
import { Icone, Logo } from "./icone";
import { rendu } from "./riche";

export function Ferme({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const s = c.ferme;
  return (
    <section className="section" id="la-ferme" aria-labelledby="titre-ferme">
      <div className="container">
        <header className="intro intro--wide" data-stagger="">
          <p className="label" data-reveal="left">
            <Icone id="i-farm" />
            {r(s.surTitre)}
          </p>
          <h2 className="section__title" id="titre-ferme" data-reveal="">
            {r(s.titre)}
          </h2>
          <p className="farm__text" data-reveal="">
            {r(s.texte)}
          </p>
        </header>

        <figure className="farm__photo" data-reveal="scale">
          <img
            src="/photos/ferme-1600.webp"
            srcSet="/photos/ferme-800.webp 800w, /photos/ferme-1600.webp 1600w"
            sizes="(min-width: 1200px) 1140px, 100vw"
            width={1600}
            height={1067}
            alt="Poulets de chair blancs dans leur enclos en terre, devant le poulailler"
            loading="lazy"
            decoding="async"
          />
        </figure>

        <div className="pledges" id="engagements">
          <div className="pledges__head" data-reveal="">
            <h3 className="pledges__title">{r(s.engagements.titre)}</h3>
            <p className="pledges__promise">{r(s.engagements.promesse)}</p>
          </div>
          <ol className="pledges__list" data-stagger="">
            {s.engagements.liste.map((e) => (
              <li className="pledge" data-reveal="" key={e.titre}>
                <h4 className="pledge__name">{e.titre}</h4>
                <p>{r(e.texte)}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="split split--even farm__more">
          <div data-reveal="">
            <h3 className="block__title block__title--small">{r(s.limites.titre)}</h3>
            <ul className="limits">
              {s.limites.elements.map((e, i) => (
                <li key={i}>{r(e)}</li>
              ))}
            </ul>
          </div>
          <div data-reveal="">
            <h3 className="block__title block__title--small">{r(s.visite.titre)}</h3>
            <p>{r(s.visite.texte)}</p>
            <p>
              <a className="link" href="#nous-trouver">
                {s.visite.lien}
              </a>
            </p>
          </div>
        </div>

        {/* Suivre la ferme : page Facebook et chaîne WhatsApp */}
        <aside className="follow" aria-labelledby="titre-suivre" data-reveal="">
          <Logo classe="follow__logo" />
          <div>
            <h3 className="follow__title" id="titre-suivre">
              {r(s.suivre.titre)}
            </h3>
            <p className="follow__text">{r(s.suivre.texte)}</p>
          </div>
          <div className="follow__actions">
            <a className="btn btn--primary" href={c.coordonnees.facebook} target="_blank" rel="noopener noreferrer" data-cta="follow_facebook">
              <Icone id="i-facebook" />
              {s.suivre.boutonFacebook}
            </a>
            <a
              className="btn btn--secondary"
              href={c.coordonnees.chaineWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="follow_channel"
            >
              <Icone id="i-channel" />
              {s.suivre.boutonChaine}
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function Questions({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const s = c.questions;
  return (
    <section className="section section--mist" id="questions" aria-labelledby="titre-questions">
      <div className="container faq">
        <header className="faq__head" data-stagger="">
          <p className="label" data-reveal="left">
            <Icone id="i-help" />
            {r(s.surTitre)}
          </p>
          <h2 className="section__title" id="titre-questions" data-reveal="">
            {r(s.titre)}
          </h2>
        </header>

        <div className="faq__groups" data-stagger="">
          {s.groupes.map((g) => (
            <div className="faq__group" data-reveal="" key={g.titre}>
              <h3 className="faq__group-title">{g.titre}</h3>
              {g.questions.map((q, i) => (
                <details className="qa" key={i}>
                  <summary>{r(q.question)}</summary>
                  <div className="qa__a">
                    <p>{r(q.reponse)}</p>
                  </div>
                </details>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
