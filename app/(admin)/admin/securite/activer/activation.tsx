"use client";

import { useActionState } from "react";
import { confirmerTotp, preparerTotp, type EtatActivation } from "./actions";

export function Activation() {
  const [etat, preparer, prepEnCours] = useActionState(preparerTotp, {} as EtatActivation);
  const [conf, confirmer, confEnCours] = useActionState(confirmerTotp, {});

  if (!etat.qr) {
    return (
      <form action={preparer} className="carte" noValidate>
        {etat.erreur && (
          <p className="message message--erreur" role="alert">
            {etat.erreur}
          </p>
        )}
        <div className="champ">
          <label htmlFor="motDePasse">Votre mot de passe</label>
          <input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" required />
        </div>
        <div className="actions">
          <button className="btn" type="submit" disabled={prepEnCours}>
            Continuer
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <section className="carte" aria-labelledby="t-qr">
        <h2 id="t-qr">1. Ajoutez le compte à votre application</h2>
        <p>
          Ouvrez votre application d’authentification (Google Authenticator, Microsoft Authenticator, Aegis…) et scannez ce
          code.
        </p>
        <div className="qr" role="img" aria-label="QR code à scanner avec l’application d’authentification" dangerouslySetInnerHTML={{ __html: etat.qr }} />
        <p className="discret">
          Sans appareil photo, saisissez cette clé&nbsp;: <code>{etat.secret}</code>
        </p>
      </section>
      <section className="carte" aria-labelledby="t-codes">
        <h2 id="t-codes">2. Gardez vos 10 codes de secours</h2>
        <p>
          Chacun ne sert qu’une fois, si vous perdez votre téléphone. Notez-les sur papier et rangez-les en lieu sûr&nbsp;: ils
          ne seront plus affichés.
        </p>
        <ul className="codes">
          {etat.codes?.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
      <form action={confirmer} className="carte" noValidate>
        <h2>3. Confirmez avec un premier code</h2>
        {conf.erreur && (
          <p className="message message--erreur" role="alert">
            {conf.erreur}
          </p>
        )}
        <div className="champ">
          <label htmlFor="code">Code à 6 chiffres</label>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required />
        </div>
        <div className="actions">
          <button className="btn" type="submit" disabled={confEnCours}>
            Activer et continuer
          </button>
        </div>
      </form>
    </>
  );
}
