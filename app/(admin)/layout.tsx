// Racine du back-office (/admin) : document à part (pas de script de tête ni de moteur
// du site), jamais indexé. Les pages lisent la session : elles sont rendues en entier à
// la requête, sans coquille statique ni flux (instant = false). Avec une limite
// <Suspense>, le contenu arriverait en flux et ne s’afficherait pas sans JavaScript.

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { policeTexte, policeTitre } from "@/app/polices";
import "./admin.css";

/** Rendu bloquant, sans coquille statique (Cache Components). */
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Back-office — Hope & Peace Farm", template: "%s — Back-office Hope & Peace Farm" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#104A21",
  colorScheme: "light",
};

export default function RacineAdmin({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${policeTitre.variable} ${policeTexte.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
