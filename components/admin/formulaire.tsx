"use client";

// Formulaire du back-office relié à une action serveur (useActionState). Il marche
// aussi sans JavaScript (envoi classique, la page renvoyée affiche le résultat). Le
// message de l’action est annoncé aux lecteurs d’écran (role="alert" / "status").

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import type { EtatAction } from "@/lib/admin/etat";

export function Formulaire({
  action,
  children,
  className,
  bouton,
  boutonClasse = "btn",
  etatInitial = {},
}: {
  action: (etat: EtatAction, donnees: FormData) => Promise<EtatAction>;
  children: ReactNode;
  className?: string;
  bouton?: string;
  boutonClasse?: string;
  etatInitial?: EtatAction;
}) {
  const [etat, envoyer, enCours] = useActionState(action, etatInitial);
  // Envoi sans la remise à zéro automatique de React : après une erreur, la saisie reste.
  const soumettre = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const bouton = (e.nativeEvent as SubmitEvent).submitter;
    // FormData(form, submitter) manque avant Safari 16.4 : le bouton est alors ajouté à la main.
    const donnees = new FormData(e.currentTarget);
    if (bouton instanceof HTMLButtonElement && bouton.name) donnees.set(bouton.name, bouton.value);
    startTransition(() => envoyer(donnees));
  };
  return (
    <form action={envoyer} onSubmit={soumettre} className={className} noValidate>
      <Retour etat={etat} />
      {children}
      {bouton && (
        <div className="actions">
          <button className={boutonClasse} type="submit" disabled={enCours} aria-disabled={enCours}>
            {enCours ? "Un instant…" : bouton}
          </button>
        </div>
      )}
    </form>
  );
}

export function Retour({ etat }: { etat: EtatAction }) {
  if (etat.erreur || etat.erreurs?.length) {
    return (
      <div className="message message--erreur" role="alert">
        {etat.erreur && <p>{etat.erreur}</p>}
        {etat.erreurs?.length ? (
          <ul>
            {etat.erreurs.map((e) => (
              <li key={`${e.chemin}:${e.message}`}>
                {e.libelle ? <strong>{e.libelle}&nbsp;: </strong> : null}
                {e.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (etat.ok) {
    return (
      <div className="message message--ok" role="status">
        <p>{etat.ok}</p>
        {etat.details?.length ? (
          <ul>
            {etat.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return null;
}
