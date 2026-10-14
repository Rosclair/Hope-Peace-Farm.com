import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DocumentSite } from "@/components/site/document";
import { configSite } from "@/lib/config";
import { contenuPublie } from "@/lib/contenu/lecture";

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
  return <DocumentSite c={await contenuPublie()}>{children}</DocumentSite>;
}
