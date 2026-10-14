// Aperçu du brouillon (brief §4.6) : la page publique rendue avec le contenu du
// brouillon, par les mêmes composants, jamais en cache ni indexée. Réservé au
// propriétaire (vérifié aussi par le document racine). Les formulaires y fonctionnent
// comme sur le site (une demande envoyée depuis l’aperçu est une vraie demande) : un
// bandeau rappelle qu’il s’agit de l’aperçu.

import { PageSite } from "@/components/site/page";
import { exigerCompte } from "@/lib/auth/session";
import { configSite } from "@/lib/config";
import { lireBrouillon } from "@/lib/contenu/depot";
import { schemaContenu } from "@/lib/contenu/schema";
import "@/app/maquette.css";
import "@/app/site.css";
import "./apercu.css";

export default async function Apercu() {
  await exigerCompte("proprietaire");
  const analyse = schemaContenu.safeParse((await lireBrouillon())?.donnees);
  if (!analyse.success) {
    return (
      <main className="apercu-erreur">
        <h1>Aperçu impossible</h1>
        <p>Le brouillon ne respecte pas le schéma du contenu. Corrigez-le depuis le back-office.</p>
        <p>
          <a href="/admin/publier">Retour</a>
        </p>
      </main>
    );
  }
  return (
    <>
      <p className="apercu-badge" role="note">
        Aperçu du brouillon · <a href="/admin/publier">Retour au back-office</a>
      </p>
      <PageSite c={analyse.data} annee={new Date(Date.now() + 36e5).getUTCFullYear()} siteUrl={configSite().SITE_URL} />
    </>
  );
}
