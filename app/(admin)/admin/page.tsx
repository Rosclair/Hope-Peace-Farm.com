// Tableau de bord (brief §4.2) : nouvelles demandes, demandes à relancer (plus de 24 h
// sans changement), e-mails en échec, valeurs « à confirmer », dernières modifications.

import type { Metadata } from "next";
import Link from "next/link";
import { Cadre } from "@/components/admin/cadre";
import { indicateursDemandes, LIBELLES_STATUT, LIBELLES_TYPE } from "@/lib/admin/demandes";
import { dateHeure, depuis } from "@/lib/admin/format";
import { dernieresModifications, LIBELLES_ACTION } from "@/lib/admin/journal";
import { GROUPES_LIBELLES } from "@/lib/admin/libelles";
import { exigerCompte } from "@/lib/auth/session";
import { lireBrouillon, lireVersionEnLigne } from "@/lib/contenu/depot";
import { empreinteContenu } from "@/lib/contenu/empreinte";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBord({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const compte = await exigerCompte();
  const proprietaire = compte.role === "proprietaire";
  const p = await searchParams;
  const [ind, brouillon, enLigne, modifications] = await Promise.all([
    indicateursDemandes(),
    proprietaire ? lireBrouillon() : null,
    proprietaire ? lireVersionEnLigne() : null,
    proprietaire ? dernieresModifications() : [],
  ]);
  const enAttente = Boolean(brouillon && enLigne && empreinteContenu(brouillon.donnees) !== enLigne.empreinte);

  return (
    <Cadre compte={compte} rubrique="accueil">
      <h1>Tableau de bord</h1>
      {p.bienvenue && (
        <p className="message message--ok" role="status">
          Second facteur activé. Pensez à changer votre mot de passe provisoire (Sécurité).
        </p>
      )}
      {p.refus && (
        <p className="message message--attention" role="status">
          Cette partie du back-office est réservée au propriétaire.
        </p>
      )}

      <div className="grille">
        <Link className="chiffre" href="/admin/demandes?statut=nouvelle">
          <strong>{ind.nouvelles}</strong> nouvelle{ind.nouvelles > 1 ? "s" : ""} demande{ind.nouvelles > 1 ? "s" : ""}
        </Link>
        <Link className={`chiffre${ind.aRelancer ? " chiffre--alerte" : ""}`} href="/admin/demandes?statut=a_relancer">
          <strong>{ind.aRelancer}</strong> à relancer
        </Link>
        <div className={`chiffre${ind.emailsEchec ? " chiffre--alerte" : ""}`}>
          <strong>{ind.emailsEchec}</strong> e-mail{ind.emailsEchec > 1 ? "s" : ""} en échec
        </div>
        {brouillon && (
          <Link className="chiffre" href="/admin/contenus?a_confirmer=1">
            <strong>{brouillon.aConfirmer.length}</strong> valeur{brouillon.aConfirmer.length > 1 ? "s" : ""} à confirmer
          </Link>
        )}
      </div>

      {ind.emailsEchec > 0 && (
        <p className="message message--attention">
          Des e-mails de notification n’ont pas pu partir. Les demandes sont bien enregistrées&nbsp;: consultez-les ici. Vérifiez
          les réglages SMTP chez l’hébergeur.
        </p>
      )}
      {enAttente && (
        <p className="message message--attention">
          Le brouillon contient des modifications non publiées. <Link href="/admin/publier">Voir et publier</Link>
        </p>
      )}

      <section className="carte" aria-labelledby="t-nouvelles">
        <h2 id="t-nouvelles">Nouvelles demandes</h2>
        {ind.dernieres.length === 0 ? (
          <p>Aucune nouvelle demande.</p>
        ) : (
          <ul className="liste">
            {ind.dernieres.map((d) => (
              <li key={d.id} className="ligne">
                <Link href={`/admin/demandes/${d.reference}`}>
                  {d.nom} · {LIBELLES_TYPE[d.type]}
                </Link>
                <span className="discret">{depuis(d.creeLe)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte" aria-labelledby="t-relance">
        <h2 id="t-relance">À relancer</h2>
        {ind.listeRelance.length === 0 ? (
          <p>Rien à relancer.</p>
        ) : (
          <ul className="liste">
            {ind.listeRelance.map((d) => (
              <li key={d.id} className="ligne">
                <Link href={`/admin/demandes/${d.reference}`}>
                  {d.nom} · {LIBELLES_STATUT[d.statut]}
                </Link>
                <span className="discret">inchangée {depuis(d.statutChangeLe)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {proprietaire && (
        <section className="carte" aria-labelledby="t-modifs">
          <h2 id="t-modifs">Dernières modifications</h2>
          {modifications.length === 0 ? (
            <p>Aucune modification pour le moment.</p>
          ) : (
            <ul className="liste">
              {modifications.map((m) => (
                <li key={m.id} className="ligne">
                  <span>
                    {LIBELLES_ACTION[m.action] ?? m.action}
                    {m.cibleId && m.action === "contenu.modifier" ? ` · ${GROUPES_LIBELLES[m.cibleId]?.titre ?? m.cibleId}` : ""}
                    {m.cibleId && (m.action === "contenu.publier" || m.action === "contenu.restaurer") ? ` · version n° ${m.cibleId}` : ""}
                  </span>
                  <span className="discret">
                    {dateHeure(m.le)}
                    {m.auteur ? ` · ${m.auteur}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Cadre>
  );
}
