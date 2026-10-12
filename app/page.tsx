// Page publique : portage fidèle de la maquette (reference/hope-and-peace-farm-apercu-2.html),
// en composants serveur rendus à partir du contenu publié. Le moteur (lib/moteur) agit en
// deux temps : script en ligne en fin de page, puis formulaires après l’hydratation.

import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Accueil, Deroule, Garanties, Portes } from "@/components/site/accueil";
import { BandeauFetes, BarreFixe, EnTete, JsonLd, LogoVolant, PiedDePage, Sprite } from "@/components/site/cadre";
import { Ceremonies } from "@/components/site/ceremonies";
import { Comportements } from "@/components/site/client/comportements";
import { Demande } from "@/components/site/demande";
import { Ferme, Questions } from "@/components/site/ferme";
import { Livraison, Poulets, Professionnels } from "@/components/site/offres";
import { configSite } from "@/lib/config";
import { contenuPublie } from "@/lib/contenu/lecture";
import { MOTEUR_IMMEDIAT } from "@/lib/site/moteur-immediat";
import "./maquette.css";

/** Année du © du pied de page, à l’heure de Douala (UTC+1). */
async function anneeDouala(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date(Date.now() + 36e5).getUTCFullYear();
}

export async function generateMetadata(): Promise<Metadata> {
  const c = await contenuPublie();
  return {
    title: c.seo.titre,
    description: c.seo.description,
    alternates: { canonical: "/" },
    // Image Open Graph : à créer en phase 7 (celle que cite la maquette n’existe pas).
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Hope & Peace Farm",
      title: c.seo.titre,
      description: c.seo.description,
      url: "/",
    },
  };
}

export default async function PagePublique() {
  const c = await contenuPublie();
  const annee = await anneeDouala();
  return (
    <>
      <Sprite />
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      {c.fetes.actif && <BandeauFetes c={c} />}
      <EnTete c={c} />
      <LogoVolant />

      <main id="contenu" tabIndex={-1}>
        <Accueil c={c} />
        <Garanties c={c} />
        <Portes c={c} />
        <Deroule c={c} />
        <Ceremonies c={c} />
        <Poulets c={c} />
        <Professionnels c={c} />
        <Livraison c={c} />
        <Ferme c={c} />
        <Questions c={c} />
        <Demande c={c} />
      </main>

      <PiedDePage c={c} annee={annee} />
      <BarreFixe c={c} />
      {/* Moteur immédiat, en ligne comme le script de la maquette : il agit avant le
          JavaScript de Next.js. En développement, Comportements le lance après l’hydratation. */}
      {process.env.NODE_ENV === "production" && <script dangerouslySetInnerHTML={{ __html: MOTEUR_IMMEDIAT }} />}
      <JsonLd c={c} siteUrl={configSite().SITE_URL} />
      <Comportements />
    </>
  );
}
