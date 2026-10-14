// Corps de la page publique : portage fidèle de la maquette, rendu à partir d’un
// contenu (publié pour le site, brouillon pour l’aperçu du back-office). Le moteur
// (lib/moteur) agit en deux temps : script en ligne en fin de page, puis formulaires
// après l’hydratation.

import { Accueil, Deroule, Garanties, Portes } from "@/components/site/accueil";
import { BandeauFetes, BarreFixe, EnTete, JsonLd, LogoVolant, PiedDePage, Sprite } from "@/components/site/cadre";
import { Ceremonies } from "@/components/site/ceremonies";
import { Comportements } from "@/components/site/client/comportements";
import { Demande } from "@/components/site/demande";
import { Ferme, Questions } from "@/components/site/ferme";
import { Livraison, Poulets, Professionnels } from "@/components/site/offres";
import type { ContenuPage } from "@/lib/contenu/types";
import { MOTEUR_IMMEDIAT } from "@/lib/site/moteur-immediat";

export function PageSite({ c, annee, siteUrl }: { c: ContenuPage; annee: number; siteUrl: string }) {
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
      <JsonLd c={c} siteUrl={siteUrl} />
      <Comportements />
    </>
  );
}
