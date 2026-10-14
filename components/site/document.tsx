// Élément <html> de la page publique, commun au site et à l’aperçu du brouillon
// (/admin/apercu) : classes des Fêtes posées par le serveur, réglages lus par le
// script de tête et le moteur (data-wa, data-fetes-*), comme la maquette.

import type { ReactNode } from "react";
import { policeTexte, policeTitre } from "@/app/polices";
import { classesFetes } from "@/lib/contenu/fetes";
import type { ContenuPage } from "@/lib/contenu/types";
import { SCRIPT_TETE } from "@/lib/site/script-tete";

export async function DocumentSite({ c, children }: { c: ContenuPage; children: ReactNode }) {
  // Classes des Fêtes posées aussi par le serveur : juste sans JavaScript (le script de tête les complète).
  const fetes = await classesFetes(c.fetes.actif, c.fetes.dateLimitePrixGaranti, c.fetes.dateFin);
  return (
    // suppressHydrationWarning : le script de tête change les classes avant l’hydratation.
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
