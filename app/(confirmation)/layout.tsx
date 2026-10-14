// Racine de la page de confirmation des demandes envoyées sans JavaScript. Même
// document que la page publique, mais racine à part : cette page est rendue en entier à
// la requête (instant = false, voir page.tsx), et, placée sous la racine du site, ce
// réglage empêchait la revalidation de la page d’accueil de prendre effet aussitôt
// (mesuré : tests/e2e/publication.test.ts).

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DocumentSite } from "@/components/site/document";
import { configSite } from "@/lib/config";
import { contenuPublie } from "@/lib/contenu/lecture";

export const instant = false;

export const metadata: Metadata = {
  metadataBase: new URL(configSite().SITE_URL),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#104A21",
  colorScheme: "light",
};

export default async function RacineConfirmation({ children }: { children: ReactNode }) {
  return <DocumentSite c={await contenuPublie()}>{children}</DocumentSite>;
}
