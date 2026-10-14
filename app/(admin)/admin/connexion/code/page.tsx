import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSeule } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { lireAttente } from "@/lib/auth/connexion";
import { verifierCode } from "../actions";

export const metadata: Metadata = { title: "Code de connexion" };

export default async function PageCode() {
  if (!(await lireAttente())) redirect("/admin/connexion");
  return (
    <PageSeule>
      <h1>Code de connexion</h1>
      <div className="carte">
        <Formulaire action={verifierCode} bouton="Se connecter">
          <div className="champ">
            <label htmlFor="code">Code</label>
            <span className="aide" id="code-aide">
              Les 6 chiffres affichés par votre application d’authentification, ou l’un de vos codes de secours.
            </span>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-describedby="code-aide"
              required
            />
          </div>
        </Formulaire>
      </div>
      <p>
        <Link href="/admin/connexion">Recommencer</Link>
      </p>
    </PageSeule>
  );
}
