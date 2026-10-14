import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cadre } from "@/components/admin/cadre";
import { champsDuGroupe, feuilles, GROUPES, lireChemin } from "@/lib/admin/champs";
import { CHAMPS_SENSIBLES, GROUPES_LIBELLES, libelleDe } from "@/lib/admin/libelles";
import { exigerCompte } from "@/lib/auth/session";
import { lireBrouillon } from "@/lib/contenu/depot";
import { REPERES, valeurRepere } from "@/lib/contenu/reperes";
import { schemaContenu } from "@/lib/contenu/schema";
import { Editeur } from "../editeur";

export async function generateMetadata({ params }: { params: Promise<{ groupe: string }> }): Promise<Metadata> {
  const { groupe } = await params;
  return { title: GROUPES_LIBELLES[groupe]?.titre ?? "Contenus" };
}

export default async function PageGroupe({ params }: { params: Promise<{ groupe: string }> }) {
  const compte = await exigerCompte("proprietaire");
  const { groupe } = await params;
  if (!GROUPES.includes(groupe as (typeof GROUPES)[number])) notFound();
  const brouillon = await lireBrouillon();
  if (!brouillon) notFound();

  const champs = champsDuGroupe(groupe, lireChemin(brouillon.donnees, groupe));
  const valeurs = Object.fromEntries(
    feuilles(champs).map((c) => {
      const v = lireChemin(brouillon.donnees, c.chemin);
      return [c.chemin, c.genre === "booleen" ? (v ? "1" : "") : v === undefined || v === null ? "" : String(v)];
    }),
  );
  // Valeurs des repères, pour le rendu final sous les textes.
  const contenu = schemaContenu.safeParse(brouillon.donnees);
  const reperes = contenu.success ? Object.fromEntries(Object.keys(REPERES).map((r) => [r, valeurRepere(contenu.data, r).texte])) : {};
  const sensibles = CHAMPS_SENSIBLES.filter((c) => c.startsWith(`${groupe}.`)).map((c) => libelleDe(c).toLowerCase());
  const info = GROUPES_LIBELLES[groupe];

  return (
    <Cadre compte={compte} rubrique="contenus">
      <p>
        <Link href="/admin/contenus">← Contenus</Link>
      </p>
      <h1>{info?.titre ?? groupe}</h1>
      {info?.aide && <p>{info.aide}</p>}
      <p className="discret">
        Repères utilisables dans les textes&nbsp;: une valeur entre accolades, par exemple <code>{"{delais.devis}"}</code>, est
        remplacée sur le site. <code>**texte**</code> met en gras, <code>[texte](#ancre)</code> crée un lien vers une section.
      </p>
      <div className="carte">
        <Editeur
          groupe={groupe}
          champs={champs}
          valeurs={valeurs}
          aConfirmer={brouillon.aConfirmer}
          revision={brouillon.revision}
          sensibles={sensibles}
          reperes={reperes}
        />
      </div>
    </Cadre>
  );
}
