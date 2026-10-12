// Section Cérémonies (#ceremonies, #formules, #exemple, #distance).
// L’exemple de devis est calculé : quantité × prix « prêt à cuire », acompte, solde.

import { fcfa, nombre } from "@/lib/contenu/format";
import type { ContenuPage } from "@/lib/contenu/types";
import { MESSAGE_VIDEO, lienWa } from "@/lib/whatsapp/messages";
import { Icone } from "./icone";
import { rendu } from "./riche";

/** Cellule vide du tableau comparatif : tiret visible, « Non » pour les lecteurs d’écran. */
function Non() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="visually-hidden">Non</span>
    </>
  );
}

export function Ceremonies({ c }: { c: ContenuPage }) {
  const { r } = rendu(c);
  const s = c.ceremonies;
  const ex = s.exemple;
  const total = ex.quantite * c.prix.pretACuire;
  const acompte = Math.round((total * c.conditions.acomptePourcent) / 100);
  return (
    <section className="section section--ceremonies" id="ceremonies" aria-labelledby="titre-ceremonies">
      <div className="container">
        <header className="intro" data-stagger="">
          <p className="label" data-reveal="left">
            <Icone id="i-people" />
            {r(s.surTitre)}
          </p>
          <h2 className="section__title" id="titre-ceremonies" data-reveal="">
            {r(s.titre)}
          </h2>
          <p className="section__lead" data-reveal="">
            {r(s.chapeau)}
          </p>
          <a className="btn btn--primary" href="#devis" data-demande="ceremonie" data-primary-cta="" data-reveal="">
            {s.bouton}
          </a>
        </header>

        <div className="block" id="formules">
          <h3 className="block__title" data-reveal="">
            {r(s.formules.titre)}
          </h3>

          {/* Mobile : chaque formule ne liste que ce qu’elle ajoute à la précédente */}
          <ul className="plans" data-stagger="">
            {s.formules.liste.map((f) => (
              <li className="plan" data-reveal="" key={f.nom}>
                <h4 className="plan__name">{f.nom}</h4>
                <p className="plan__for">{r(f.pourQui)}</p>
                {f.plus && <p className="plan__plus">{r(f.plus)}</p>}
                <ul className="plan__list">
                  {f.elements.map((e, i) => (
                    <li key={i}>{r(e)}</li>
                  ))}
                </ul>
                <p className="plan__delay">{r(f.delai)}</p>
              </li>
            ))}
          </ul>

          {/* Ordinateur et tablette : tableau comparatif */}
          <div className="table-wrap plans-table" data-reveal="">
            <table className="compare">
              <caption className="visually-hidden">Comparaison des trois formules cérémonie</caption>
              <thead>
                <tr>
                  <td></td>
                  {s.formules.liste.map((f) => (
                    <th scope="col" key={f.nom}>
                      {f.nom}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.formules.tableau.map((ligne) => (
                  <tr key={ligne.critere}>
                    <th scope="row">{ligne.critere}</th>
                    {ligne.valeurs.map((v, i) => (
                      <td key={i}>{v ? r(v) : <Non />}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="terms" data-reveal="">
            {s.formules.conditions.map((p, i) => (
              <p key={i}>{r(p)}</p>
            ))}
          </div>
        </div>

        <div className="split">
          <div className="block" data-reveal="">
            <h3 className="block__title">{r(s.methode.titre)}</h3>
            <ol className="steps">
              {s.methode.etapes.map((e, i) => (
                <li key={i}>{r(e)}</li>
              ))}
            </ol>
          </div>

          <div className="block" id="exemple" data-reveal="">
            <h3 className="block__title">{r(ex.titre)}</h3>
            <div className="quote">
              <table className="quote__table">
                <caption className="visually-hidden">{`Exemple de devis pour ${ex.quantite} ${ex.libelle.toLowerCase()}`}</caption>
                <tbody>
                  <tr>
                    <th scope="row">
                      {ex.libelle}
                      <span className="quote__detail">
                        {`${nombre(ex.quantite)} × ${fcfa(c.prix.pretACuire)}`}
                      </span>
                    </th>
                    <td>{fcfa(total)}</td>
                  </tr>
                  <tr className="quote__sum">
                    <th scope="row">{ex.total}</th>
                    <td>{fcfa(total)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{r(ex.acompte)}</th>
                    <td>{fcfa(acompte)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{ex.solde}</th>
                    <td>{fcfa(total - acompte)}</td>
                  </tr>
                  <tr className="quote__note">
                    <td colSpan={2}>{r(ex.note)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="quote__mention">{r(ex.mention)}</p>
            </div>
          </div>
        </div>

        <aside className="callout" id="distance" aria-labelledby="titre-distance" data-reveal="">
          <Icone id="i-video" classe="icon callout__icon" />
          <div className="callout__body">
            <h3 className="callout__title" id="titre-distance">
              {r(s.distance.titre)}
            </h3>
            <p>{r(s.distance.texte)}</p>
            <div className="callout__actions">
              <a
                className="btn btn--secondary"
                href={lienWa(c.coordonnees.whatsapp, MESSAGE_VIDEO)}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="cer_video"
              >
                {s.distance.bouton}
                <span className="visually-hidden"> (WhatsApp)</span>
              </a>
              <a className="link" href="#payer">
                {s.distance.lien}
              </a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
