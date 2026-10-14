import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageSeule } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { lireCompte } from "@/lib/auth/session";
import { connexion } from "./actions";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const compte = await lireCompte();
  const invitation = (await searchParams).invitation === "1";
  if (compte) redirect(compte.deuxFacteurs ? "/admin" : "/admin/securite/activer");
  return (
    <PageSeule>
      <h1>Connexion</h1>
      {invitation && (
        <p className="message message--ok" role="status">
          Compte créé. Connectez-vous avec votre e-mail et votre mot de passe&nbsp;: le back-office vous demandera ensuite
          d’installer le second facteur.
        </p>
      )}
      <div className="carte">
        <Formulaire action={connexion} bouton="Continuer">
          <div className="champ">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="champ">
            <label htmlFor="motDePasse">Mot de passe</label>
            <input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" required />
          </div>
        </Formulaire>
      </div>
      <p className="discret">
        Après 5 essais manqués, le compte est verrouillé 15 minutes. Mot de passe oublié&nbsp;: demandez au propriétaire de
        vous réinviter.
      </p>
    </PageSeule>
  );
}
