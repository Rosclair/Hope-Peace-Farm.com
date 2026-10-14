// Acceptation d’une invitation : la personne choisit son mot de passe ; à la première
// connexion, le second facteur lui est imposé.

import type { Metadata } from "next";
import Link from "next/link";
import { PageSeule } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { LONGUEUR_MIN_MOT_DE_PASSE, lireInvitation } from "@/lib/auth/comptes";
import { accepter } from "./actions";

export const metadata: Metadata = { title: "Invitation" };

export default async function PageInvitation({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const inv = await lireInvitation(jeton);
  return (
    <PageSeule>
      <h1>Invitation au back-office</h1>
      {!inv ? (
        <p className="message message--erreur">
          Ce lien n’est plus valable (déjà utilisé ou expiré). Demandez une nouvelle invitation. <Link href="/admin/connexion">Connexion</Link>
        </p>
      ) : (
        <div className="carte">
          <p>
            Bonjour {inv.nom}. Choisissez votre mot de passe pour <strong>{inv.email}</strong>.
          </p>
          <Formulaire action={accepter} bouton="Créer mon compte">
            <input type="hidden" name="jeton" value={jeton} />
            <input type="text" name="username" autoComplete="username" defaultValue={inv.email} hidden readOnly />
            <div className="champ">
              <label htmlFor="mdp">Mot de passe</label>
              <span className="aide" id="mdp-aide">
                {LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins.
              </span>
              <input id="mdp" name="motDePasse" type="password" autoComplete="new-password" aria-describedby="mdp-aide" required />
            </div>
            <div className="champ">
              <label htmlFor="mdp2">Mot de passe, encore</label>
              <input id="mdp2" name="confirmation" type="password" autoComplete="new-password" required />
            </div>
          </Formulaire>
        </div>
      )}
    </PageSeule>
  );
}
