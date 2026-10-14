import type { Metadata } from "next";
import { Cadre } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { dateHeure } from "@/lib/admin/format";
import { invitationsEnCours, listeComptes, LONGUEUR_MIN_MOT_DE_PASSE, sessionsActives } from "@/lib/auth/comptes";
import { exigerCompte } from "@/lib/auth/session";
import { activation, annuler, changerMotDePasse, inviter, nouveauxCodes, revoquer } from "./actions";

export const metadata: Metadata = { title: "Sécurité" };

export default async function PageSecurite() {
  const compte = await exigerCompte();
  const proprietaire = compte.role === "proprietaire";
  const [sessions, comptes, invitations] = await Promise.all([
    sessionsActives(compte.id),
    proprietaire ? listeComptes() : [],
    proprietaire ? invitationsEnCours() : [],
  ]);

  return (
    <Cadre compte={compte} rubrique="securite">
      <h1>Sécurité</h1>

      <section className="carte" aria-labelledby="t-sessions">
        <h2 id="t-sessions">Sessions actives</h2>
        <p>Chaque appareil connecté à votre compte. Fermez celles que vous ne reconnaissez pas (téléphone perdu, ordinateur prêté).</p>
        <ul className="liste">
          {sessions.map((s) => (
            <li key={s.id} className="ligne">
              <span>
                <strong>{s.appareil ?? "Appareil inconnu"}</strong>
                <span className="discret">
                  {" "}
                  · ouverte le {dateHeure(s.creeLe)} · active le {dateHeure(s.majLe)}
                </span>
              </span>
              {s.id === compte.sessionId ? (
                <span className="pastille">cet appareil</span>
              ) : (
                <Formulaire action={revoquer} bouton="Fermer" boutonClasse="btn btn--second">
                  <input type="hidden" name="session" value={s.id} />
                </Formulaire>
              )}
            </li>
          ))}
        </ul>
        {sessions.length > 1 && (
          <Formulaire action={revoquer} bouton="Fermer toutes les autres sessions" boutonClasse="btn btn--second">
            <input type="hidden" name="session" value="autres" />
          </Formulaire>
        )}
      </section>

      <section className="carte" aria-labelledby="t-mdp">
        <h2 id="t-mdp">Mot de passe</h2>
        <Formulaire action={changerMotDePasse} bouton="Changer le mot de passe">
          <input type="text" name="username" autoComplete="username" defaultValue={compte.email} hidden readOnly />
          <div className="champ">
            <label htmlFor="actuel">Mot de passe actuel</label>
            <input id="actuel" name="actuel" type="password" autoComplete="current-password" required />
          </div>
          <div className="champ">
            <label htmlFor="nouveau">Nouveau mot de passe</label>
            <span className="aide" id="nouveau-aide">
              {LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins. Une phrase de plusieurs mots est facile à retenir.
            </span>
            <input id="nouveau" name="nouveau" type="password" autoComplete="new-password" aria-describedby="nouveau-aide" required />
          </div>
          <div className="champ">
            <label htmlFor="confirmation">Nouveau mot de passe, encore</label>
            <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required />
          </div>
        </Formulaire>
      </section>

      <section className="carte" aria-labelledby="t-codes">
        <h2 id="t-codes">Codes de secours</h2>
        <p>Si vous perdez votre téléphone, un code de secours remplace le code de l’application (une seule fois chacun).</p>
        <Formulaire action={nouveauxCodes} bouton="Générer 10 nouveaux codes" boutonClasse="btn btn--second">
          <div className="champ">
            <label htmlFor="mdp-codes">Votre mot de passe</label>
            <input id="mdp-codes" name="motDePasse" type="password" autoComplete="current-password" required />
          </div>
        </Formulaire>
      </section>

      {proprietaire && (
        <section className="carte" aria-labelledby="t-equipe">
          <h2 id="t-equipe">Équipe</h2>
          <p>Le rôle Équipe donne accès aux demandes seulement&nbsp;; le rôle Propriétaire, à tout.</p>
          <ul className="liste">
            {comptes.map((u) => (
              <li key={u.id}>
                <div className="ligne">
                  <span>
                    <strong>{u.nom}</strong> · {u.email}
                  </span>
                  <span className="pastille">{u.role === "proprietaire" ? "Propriétaire" : "Équipe"}</span>
                </div>
                <div className="discret">
                  {u.actif ? "Actif" : "Désactivé"}
                  {u.deuxFacteurs ? " · second facteur activé" : " · second facteur à activer"}
                  {u.verrouilleJusqua && u.verrouilleJusqua > new Date() ? ` · verrouillé jusqu’à ${dateHeure(u.verrouilleJusqua)}` : ""}
                </div>
                {u.id !== compte.id && (
                  <details>
                    <summary>{u.actif ? "Désactiver ce compte" : "Réactiver ce compte"}</summary>
                    <Formulaire action={activation} bouton={u.actif ? "Désactiver" : "Réactiver"} boutonClasse={u.actif ? "btn btn--danger" : "btn"}>
                      <input type="hidden" name="utilisateur" value={u.id} />
                      <input type="hidden" name="actif" value={u.actif ? "0" : "1"} />
                      <label className="case">
                        <input type="checkbox" name="confirmation" value="1" required />
                        <span>{u.actif ? "Je confirme : ce compte ne pourra plus se connecter." : "Je confirme la réactivation."}</span>
                      </label>
                    </Formulaire>
                  </details>
                )}
              </li>
            ))}
          </ul>

          {invitations.length > 0 && (
            <>
              <h3>Invitations en attente</h3>
              <ul className="liste">
                {invitations.map((i) => (
                  <li key={i.id} className="ligne">
                    <span>
                      {i.nom} · {i.email} · jusqu’au {dateHeure(i.expireLe)}
                    </span>
                    <Formulaire action={annuler} bouton="Annuler" boutonClasse="btn btn--second">
                      <input type="hidden" name="invitation" value={i.id} />
                    </Formulaire>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>Inviter une personne</h3>
          <Formulaire action={inviter} bouton="Créer l’invitation">
            <div className="champ">
              <label htmlFor="i-nom">Prénom et nom</label>
              <input id="i-nom" name="nom" type="text" maxLength={100} required />
            </div>
            <div className="champ">
              <label htmlFor="i-email">E-mail</label>
              <input id="i-email" name="email" type="email" autoComplete="off" required />
            </div>
            <div className="champ">
              <label htmlFor="i-role">Rôle</label>
              <select id="i-role" name="role" defaultValue="equipe">
                <option value="equipe">Équipe (demandes seulement)</option>
                <option value="proprietaire">Propriétaire (tout)</option>
              </select>
            </div>
          </Formulaire>
        </section>
      )}
    </Cadre>
  );
}
