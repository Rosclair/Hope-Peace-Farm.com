import type { Metadata } from "next";
import Link from "next/link";
import { Cadre } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import {
  estARelancer,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
  listerDemandes,
  PAR_PAGE,
  schemaFiltres,
  sourceDe,
  sourcesConnues,
  type Filtres,
} from "@/lib/admin/demandes";
import { dateHeure, depuis, numeroAffiche } from "@/lib/admin/format";
import { exigerCompte } from "@/lib/auth/session";
import { STATUTS_DEMANDE } from "@/lib/db/schema";
import { TYPES_DEMANDE } from "@/lib/demandes/schema";
import { chercherClient } from "./actions";

export const metadata: Metadata = { title: "Demandes" };

type Parametres = Promise<Record<string, string | string[] | undefined>>;

function requete(f: Partial<Filtres>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}


export default async function PageDemandes({ searchParams }: { searchParams: Parametres }) {
  const compte = await exigerCompte();
  const brut = await searchParams;
  const f = schemaFiltres.parse(Object.fromEntries(Object.entries(brut).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [{ lignes, total }, sources] = await Promise.all([listerDemandes(f), sourcesConnues()]);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const supprimees = typeof brut.supprimees === "string" ? Number(brut.supprimees) : null;
  const { page: _p, ...filtresExport } = f;

  return (
    <Cadre compte={compte} rubrique="demandes">
      <h1>Demandes</h1>
      {supprimees !== null && (
        <p className="message message--ok" role="status">
          Données du client supprimées&nbsp;: {supprimees} demande{supprimees > 1 ? "s" : ""}.
        </p>
      )}
      <form className="carte filtres" method="get" role="search" aria-label="Filtrer les demandes">
        <div className="champ">
          <label htmlFor="f-statut">Statut</label>
          <select id="f-statut" name="statut" defaultValue={f.statut ?? ""}>
            <option value="">Tous</option>
            <option value="a_relancer">À relancer (plus de 24 h)</option>
            {STATUTS_DEMANDE.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUT[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="f-type">Type</label>
          <select id="f-type" name="type" defaultValue={f.type ?? ""}>
            <option value="">Tous</option>
            {TYPES_DEMANDE.map((t) => (
              <option key={t} value={t}>
                {LIBELLES_TYPE[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="f-source">Source</label>
          <select id="f-source" name="source" defaultValue={f.source ?? ""}>
            <option value="">Toutes</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="f-du">Du</label>
          <input id="f-du" name="du" type="date" defaultValue={f.du ?? ""} />
        </div>
        <div className="champ">
          <label htmlFor="f-au">Au</label>
          <input id="f-au" name="au" type="date" defaultValue={f.au ?? ""} />
        </div>
        <div className="champ">
          <label htmlFor="f-q">Référence, nom ou numéro</label>
          <input id="f-q" name="q" type="search" defaultValue={f.q ?? ""} />
        </div>
        <div className="actions">
          <button className="btn" type="submit">
            Filtrer
          </button>
          <Link href="/admin/demandes">Effacer les filtres</Link>
        </div>
      </form>

      <div className="ligne">
        <p>
          {total} demande{total > 1 ? "s" : ""}
          {pages > 1 ? ` · page ${f.page} sur ${pages}` : ""}
        </p>
        <a className="btn btn--second" href={`/admin/demandes/export${requete(filtresExport)}`} download>
          Exporter en CSV
        </a>
      </div>

      <div className="carte">
        {lignes.length === 0 ? (
          <p>Aucune demande.</p>
        ) : (
          <ul className="liste">
            {lignes.map((d) => (
              <li key={d.id}>
                <div className="ligne">
                  <Link href={`/admin/demandes/${d.reference}`}>
                    <strong>{d.nom}</strong> · {LIBELLES_TYPE[d.type]}
                  </Link>
                  <span className={`pastille pastille--${d.statut}`}>{LIBELLES_STATUT[d.statut]}</span>
                </div>
                <div className="ligne discret">
                  <span>
                    {d.reference} · <span className="tel">{numeroAffiche(d.whatsappE164)}</span> · {sourceDe(d)}
                  </span>
                  <span>
                    {dateHeure(d.creeLe)}
                    {estARelancer(d) ? ` · à relancer (${depuis(d.statutChangeLe)})` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pages > 1 && (
        <nav className="actions" aria-label="Pages">
          {f.page > 1 && <Link href={`/admin/demandes${requete({ ...f, page: f.page - 1 })}`}>Page précédente</Link>}
          {f.page < pages && <Link href={`/admin/demandes${requete({ ...f, page: f.page + 1 })}`}>Page suivante</Link>}
        </nav>
      )}

      <details className="carte">
        <summary>Supprimer les données d’un client (à sa demande)</summary>
        <Formulaire action={chercherClient} bouton="Rechercher ses demandes" boutonClasse="btn btn--second">
          <div className="champ">
            <label htmlFor="numero">Numéro WhatsApp du client</label>
            <input id="numero" name="numero" type="tel" autoComplete="off" required />
          </div>
        </Formulaire>
      </details>
    </Cadre>
  );
}
