// Cadre des pages du back-office : en-tête, menu (selon le rôle), contenu principal.
// Le menu n’est qu’un confort : chaque page et chaque action vérifient le rôle.

import Link from "next/link";
import type { ReactNode } from "react";
import { seDeconnecter } from "@/app/(admin)/admin/actions";
import type { Compte } from "@/lib/auth/session";

type Rubrique = "accueil" | "demandes" | "contenus" | "publier" | "reglages" | "securite";

const RUBRIQUES: { id: Rubrique; libelle: string; href: string; proprietaire: boolean }[] = [
  { id: "accueil", libelle: "Tableau de bord", href: "/admin", proprietaire: false },
  { id: "demandes", libelle: "Demandes", href: "/admin/demandes", proprietaire: false },
  { id: "contenus", libelle: "Contenus", href: "/admin/contenus", proprietaire: true },
  { id: "publier", libelle: "Publier", href: "/admin/publier", proprietaire: true },
  { id: "reglages", libelle: "Réglages", href: "/admin/reglages", proprietaire: true },
  { id: "securite", libelle: "Sécurité", href: "/admin/securite", proprietaire: false },
];

export function Cadre({ compte, rubrique, children }: { compte: Compte; rubrique: Rubrique; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#principal">
        Aller au contenu
      </a>
      <header className="adm-tete">
        <Link className="adm-marque" href="/admin">
          Hope &amp; Peace Farm
        </Link>
        <div className="adm-compte">
          <span>
            {compte.nom} · {compte.role === "proprietaire" ? "Propriétaire" : "Équipe"}
          </span>
          <form action={seDeconnecter}>
            <button className="btn--lien btn" type="submit">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <nav className="adm-nav" aria-label="Back-office">
        <ul>
          {RUBRIQUES.filter((r) => !r.proprietaire || compte.role === "proprietaire").map((r) => (
            <li key={r.id}>
              <Link href={r.href} aria-current={r.id === rubrique ? "page" : undefined}>
                {r.libelle}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main id="principal" className="adm-principal" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}

/** Page seule (connexion, activation du second facteur, invitation). */
export function PageSeule({ children }: { children: ReactNode }) {
  return (
    <main id="principal" className="adm-seul">
      <p className="discret">
        Hope &amp; Peace Farm · Back-office
      </p>
      {children}
    </main>
  );
}
