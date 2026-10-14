// Page publique : portage fidèle de la maquette (reference/hope-and-peace-farm-apercu-2.html),
// en composants serveur rendus à partir du contenu publié (components/site/page.tsx).

import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { PageSite } from "@/components/site/page";
import { configSite } from "@/lib/config";
import { contenuPublie } from "@/lib/contenu/lecture";
import "@/app/maquette.css";
import "@/app/site.css";

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
  return <PageSite c={c} annee={await anneeDouala()} siteUrl={configSite().SITE_URL} />;
}
