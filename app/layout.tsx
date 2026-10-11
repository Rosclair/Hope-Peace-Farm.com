import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { configSite } from "@/lib/config";
import { SCRIPT_TETE } from "@/lib/site/script-tete";
import { policeTexte, policeTitre } from "./polices";
import "./squelette.css";

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

export default function Racine({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning : le script de tête change les classes avant l’hydratation.
    <html lang="fr" className={`no-js ${policeTitre.variable} ${policeTexte.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TETE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
