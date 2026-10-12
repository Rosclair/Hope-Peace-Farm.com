import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { configSite } from "@/lib/config";
import { classesFetes } from "@/lib/contenu/fetes";
import { contenuPublie } from "@/lib/contenu/lecture";
import { SCRIPT_TETE } from "@/lib/site/script-tete";
import { policeTexte, policeTitre } from "./polices";

const site = configSite();

export const metadata: Metadata = {
  metadataBase: new URL(site.SITE_URL),
  title: "Hope & Peace Farm",
  // Rien n’est indexé tant que SITE_INDEXABLE ne vaut pas 1 (mise en production, phase 8).
  robots: site.SITE_INDEXABLE ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#104A21",
  colorScheme: "light",
};

export default async function Racine({ children }: { children: ReactNode }) {
  const c = await contenuPublie();
  // Classes des Fêtes posées aussi par le serveur : juste sans JavaScript (le script de tête les complète).
  const fetes = await classesFetes(c.fetes.actif, c.fetes.dateLimitePrixGaranti, c.fetes.dateFin);
  return (
    // suppressHydrationWarning : le script de tête change les classes avant l’hydratation.
    // data-wa et data-fetes-* : réglages lus par le script de tête et le moteur, comme la maquette.
    <html
      lang="fr"
      className={`no-js ${policeTitre.variable} ${policeTexte.variable}${fetes ? ` ${fetes}` : ""}`}
      data-wa={c.coordonnees.whatsapp}
      data-fetes-deadline={c.fetes.actif ? c.fetes.dateLimitePrixGaranti : undefined}
      data-fetes-end={c.fetes.actif ? c.fetes.dateFin : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TETE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
