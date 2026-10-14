import type { Metadata } from "next";
import Link from "next/link";
import { Cadre } from "@/components/admin/cadre";
import { GROUPES } from "@/lib/admin/champs";
import { GROUPES_LIBELLES, libelleDe } from "@/lib/admin/libelles";
import { exigerCompte } from "@/lib/auth/session";
import { lireBrouillon } from "@/lib/contenu/depot";

export const metadata: Metadata = { title: "Contenus" };

export default async function PageContenus() {
  const compte = await exigerCompte("proprietaire");
  const brouillon = await lireBrouillon();
  const aConfirmer = brouillon?.aConfirmer ?? [];
  const parGroupe = (g: string) => aConfirmer.filter((p) => p.split(".")[0] === g);
  const valeurs = GROUPES.filter((g) => GROUPES_LIBELLES[g]?.valeurs);
  const textes = GROUPES.filter((g) => !GROUPES_LIBELLES[g]?.valeurs);

  const liste = (groupes: string[]) => (
    <ul className="liste">
      {groupes.map((g) => {
        const n = parGroupe(g).length;
        return (
          <li key={g}>
            <div className="ligne">
              <Link href={`/admin/contenus/${g}`}>
                <strong>{GROUPES_LIBELLES[g]?.titre ?? g}</strong>
              </Link>
              {n > 0 && <span className="pastille pastille--confirmer">{n} à confirmer</span>}
            </div>
            <span className="discret">{GROUPES_LIBELLES[g]?.aide}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Cadre compte={compte} rubrique="contenus">
      <h1>Contenus</h1>
      <p>
        Les modifications vont dans le <strong>brouillon</strong>&nbsp;: la page publique ne change qu’après «&nbsp;
        <Link href="/admin/publier">Publier</Link>&nbsp;». <Link href="/admin/apercu">Voir l’aperçu du brouillon</Link>.
      </p>
      {aConfirmer.length > 0 && (
        <section className="message message--attention" aria-labelledby="t-confirmer">
          <h2 id="t-confirmer">Valeurs à confirmer ({aConfirmer.length})</h2>
          <p>Reprises de la maquette, elles attendent votre accord. Décochez « À confirmer » une fois vérifiées.</p>
          <ul>
            {aConfirmer.map((p) => (
              <li key={p}>
                <Link href={`/admin/contenus/${p.split(".")[0]}#ch-${p.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
                  {GROUPES_LIBELLES[p.split(".")[0]!]?.titre} · {libelleDe(p)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="carte" aria-labelledby="t-valeurs">
        <h2 id="t-valeurs">Valeurs</h2>
        {liste(valeurs)}
      </section>
      <section className="carte" aria-labelledby="t-textes">
        <h2 id="t-textes">Textes des sections</h2>
        {liste(textes)}
      </section>
    </Cadre>
  );
}
