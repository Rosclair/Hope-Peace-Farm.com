import type { Metadata } from "next";
import Link from "next/link";
import { Cadre } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { differences } from "@/lib/admin/differences";
import { dateHeure } from "@/lib/admin/format";
import { GROUPES_LIBELLES, libelleDe } from "@/lib/admin/libelles";
import { valeurJournal } from "@/lib/audit";
import { exigerCompte } from "@/lib/auth/session";
import { controlerPublication } from "@/lib/contenu/controles";
import { historique, lireBrouillon, lireVersionEnLigne } from "@/lib/contenu/depot";
import { publierBrouillon, restaurerVersion } from "./actions";

export const metadata: Metadata = { title: "Publier" };

const MAX_DIFFERENCES = 40;
const groupeDe = (chemin: string) => chemin.split(/[.[]/)[0] ?? "";
const lienChamp = (chemin: string) => `/admin/contenus/${groupeDe(chemin)}#ch-${chemin.replace(/[^a-zA-Z0-9]+/g, "-")}`;
const court = (v: unknown) => {
  const t = v === undefined ? "(absent)" : v === "" ? "(vide)" : String(v);
  return t.length > 120 ? `${t.slice(0, 119)}…` : t;
};

export default async function PagePublier() {
  const compte = await exigerCompte("proprietaire");
  const [brouillon, enLigne, versions] = await Promise.all([lireBrouillon(), lireVersionEnLigne(), historique(30)]);
  if (!brouillon) {
    return (
      <Cadre compte={compte} rubrique="publier">
        <h1>Publier</h1>
        <p className="message message--erreur">Contenu non initialisé.</p>
      </Cadre>
    );
  }
  const controle = controlerPublication(brouillon.donnees, brouillon.aConfirmer);
  const bloquants = controle.problemes.filter((p) => p.bloquant);
  const avertissements = controle.problemes.filter((p) => !p.bloquant);
  const diff = enLigne ? differences(enLigne.donnees, brouillon.donnees) : [];

  return (
    <Cadre compte={compte} rubrique="publier">
      <h1>Publier</h1>
      <p>
        En ligne&nbsp;: <strong>version n° {enLigne?.numero ?? "—"}</strong>
        {enLigne ? `, publiée le ${dateHeure(enLigne.publieLe)}` : ""}. Brouillon modifié le {dateHeure(brouillon.modifieLe)} par{" "}
        {brouillon.modifiePar}.
      </p>
      <p>
        <Link className="btn btn--second" href="/admin/apercu" target="_blank" rel="noopener">
          Voir l’aperçu du brouillon
        </Link>
      </p>

      <section className="carte" aria-labelledby="t-diff">
        <h2 id="t-diff">Ce qui va changer</h2>
        {diff.length === 0 ? (
          <p>Le brouillon est identique à la version en ligne.</p>
        ) : (
          <>
            <p>
              {diff.length} modification{diff.length > 1 ? "s" : ""}&nbsp;:
            </p>
            <ul className="liste">
              {diff.slice(0, MAX_DIFFERENCES).map((d) => (
                <li key={d.chemin}>
                  <Link href={lienChamp(d.chemin)}>
                    {GROUPES_LIBELLES[groupeDe(d.chemin)]?.titre} · {libelleDe(d.chemin)}
                  </Link>
                  <div className="discret">
                    {court(valeurJournal(d.chemin, d.avant))} → {court(valeurJournal(d.chemin, d.apres))}
                  </div>
                </li>
              ))}
            </ul>
            {diff.length > MAX_DIFFERENCES && <p className="discret">… et {diff.length - MAX_DIFFERENCES} autres.</p>}
          </>
        )}
      </section>

      <section className="carte" aria-labelledby="t-controles">
        <h2 id="t-controles">Contrôles avant publication</h2>
        {bloquants.length === 0 ? (
          <p className="message message--ok">Aucun problème bloquant.</p>
        ) : (
          <div className="message message--erreur">
            <p>
              {bloquants.length} problème{bloquants.length > 1 ? "s" : ""} à corriger avant de publier&nbsp;:
            </p>
            <ul>
              {bloquants.map((p) => (
                <li key={`${p.chemin}:${p.message}`}>
                  {p.chemin ? <Link href={lienChamp(p.chemin)}>{libelleDe(p.chemin)}</Link> : "Document"}&nbsp;: {p.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {avertissements.length > 0 && (
          <div className="message message--attention">
            <p>
              {avertissements.length} valeur{avertissements.length > 1 ? "s" : ""} encore marquée{avertissements.length > 1 ? "s" : ""} « à confirmer »
              (la publication reste possible)&nbsp;:
            </p>
            <ul>
              {avertissements.map((p) => (
                <li key={p.chemin}>
                  <Link href={lienChamp(p.chemin)}>
                    {GROUPES_LIBELLES[groupeDe(p.chemin)]?.titre} · {libelleDe(p.chemin)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {bloquants.length === 0 && (
          <Formulaire action={publierBrouillon} bouton="Publier maintenant">
            <div className="champ">
              <label htmlFor="note">Note de version (facultatif)</label>
              <input id="note" name="note" type="text" maxLength={200} placeholder="Ex. nouveaux prix de décembre" />
            </div>
          </Formulaire>
        )}
      </section>

      <section className="carte" aria-labelledby="t-historique">
        <h2 id="t-historique">Historique des versions</h2>
        <ul className="liste">
          {versions.map((v) => (
            <li key={v.numero}>
              <div className="ligne">
                <span>
                  <strong>n° {v.numero}</strong> · {dateHeure(v.publieLe)} · {v.publiePar}
                  {v.restaureeDepuis ? ` · restaurée depuis la n° ${v.restaureeDepuis}` : ""}
                </span>
                {v.enLigne && <span className="pastille pastille--nouvelle">en ligne</span>}
              </div>
              {v.note && <div className="discret">{v.note}</div>}
              {!v.enLigne && (
                <details>
                  <summary>Revenir à cette version</summary>
                  <Formulaire action={restaurerVersion} bouton={`Remettre la n° ${v.numero} en ligne`} boutonClasse="btn btn--second">
                    <input type="hidden" name="numero" value={v.numero} />
                    <label className="case">
                      <input type="checkbox" name="confirmation" value="1" required />
                      <span>Je confirme : la page publique et le brouillon reprennent la version n° {v.numero}.</span>
                    </label>
                  </Formulaire>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Cadre>
  );
}
