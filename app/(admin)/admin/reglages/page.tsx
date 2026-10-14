import type { Metadata } from "next";
import { Cadre } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { exigerCompte } from "@/lib/auth/session";
import { adresseNotification, conservationMois } from "@/lib/reglages";
import { changerConservation, changerEmailNotification } from "./actions";

export const metadata: Metadata = { title: "Réglages" };

export default async function PageReglages() {
  const compte = await exigerCompte("proprietaire");
  const [email, mois] = await Promise.all([adresseNotification(), conservationMois()]);
  return (
    <Cadre compte={compte} rubrique="reglages">
      <h1>Réglages</h1>
      <section className="carte" aria-labelledby="t-email">
        <h2 id="t-email">E-mail de notification</h2>
        <p>Chaque nouvelle demande y est signalée. Actuellement&nbsp;: {email ? <strong>{email}</strong> : "aucune (SMTP non configuré)"}.</p>
        <Formulaire action={changerEmailNotification} bouton="Changer l’adresse">
          <div className="champ">
            <label htmlFor="email">Nouvelle adresse</label>
            <input id="email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="champ">
            <label htmlFor="code">Code de sécurité</label>
            <span className="aide" id="code-aide">
              Les 6 chiffres de votre application. Un e-mail d’alerte part à l’ancienne et à la nouvelle adresse.
            </span>
            <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" aria-describedby="code-aide" required />
          </div>
        </Formulaire>
      </section>
      <section className="carte" aria-labelledby="t-conservation">
        <h2 id="t-conservation">Conservation des demandes</h2>
        <p>
          Les demandes (avec leur historique et leurs notes) sont supprimées automatiquement après cette durée sans mise à jour.
          Actuellement&nbsp;: <strong>{mois} mois</strong>. Le texte de confidentialité du site doit dire la même durée.
        </p>
        <Formulaire action={changerConservation} bouton="Enregistrer">
          <div className="champ">
            <label htmlFor="mois">Durée (mois)</label>
            <input id="mois" name="mois" type="text" inputMode="numeric" defaultValue={mois} required />
          </div>
        </Formulaire>
      </section>
    </Cadre>
  );
}
