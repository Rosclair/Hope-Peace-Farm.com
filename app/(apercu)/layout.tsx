// Racine de l’aperçu du brouillon (/admin/apercu) : le même document que la page
// publique (components/site/document.tsx), avec le contenu du brouillon. Rendu en
// entier à la requête (instant = false) : il lit la session, et doit s’afficher aussi
// sans JavaScript.

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DocumentSite } from "@/components/site/document";
import { exigerCompte } from "@/lib/auth/session";
import { CONTENU_INITIAL } from "@/lib/contenu/initial";
import { lireBrouillon } from "@/lib/contenu/depot";
import { schemaContenu } from "@/lib/contenu/schema";

/** Rendu bloquant, sans coquille statique (Cache Components). */
export const instant = false;

export const metadata: Metadata = {
  title: "Aperçu du brouillon — Hope & Peace Farm",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#104A21",
  colorScheme: "light",
};

export default async function RacineApercu({ children }: { children: ReactNode }) {
  await exigerCompte("proprietaire");
  const analyse = schemaContenu.safeParse((await lireBrouillon())?.donnees);
  // Brouillon invalide : la page le dit (page.tsx) ; le document reprend la maquette.
  return <DocumentSite c={analyse.success ? analyse.data : CONTENU_INITIAL}>{children}</DocumentSite>;
}
