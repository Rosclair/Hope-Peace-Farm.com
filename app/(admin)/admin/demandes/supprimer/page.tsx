// Droit à l’effacement (loi n° 2024/017, brief §4.3) : toutes les demandes du numéro
// du client sont supprimées, après confirmation explicite.

import type { Metadata } from "next";
import Link from "next/link";
import { Cadre } from "@/components/admin/cadre";
import { Formulaire } from "@/components/admin/formulaire";
import { demandesDuNumero, LIBELLES_STATUT, LIBELLES_TYPE, lireDemande } from "@/lib/admin/demandes";
import { dateHeure, numeroAffiche } from "@/lib/admin/format";
import { exigerCompte } from "@/lib/auth/session";
import { confirmerSuppressionClient } from "../actions";

export const metadata: Metadata = { title: "Supprimer les données d’un client" };

export default async function PageSuppression({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const compte = await exigerCompte();
  const ref = (await searchParams).ref;
  const reference = typeof ref === "string" && /^HP-\d{6}-[A-Z0-9]{6}$/.test(ref) ? ref : null;
  const d = reference ? await lireDemande(reference) : null;
  const liste = d ? await demandesDuNumero(d.whatsappE164) : [];

  return (
    <Cadre compte={compte} rubrique="demandes">
      <p>
        <Link href={d ? `/admin/demandes/${d.reference}` : "/admin/demandes"}>← Retour</Link>
      </p>
      <h1>Supprimer les données d’un client</h1>
      {!d ? (
        <p className="message message--erreur">Demande introuvable&nbsp;: elle a peut-être déjà été supprimée.</p>
      ) : (
        <div className="carte">
          <p>
            Toutes les demandes du numéro <strong className="tel">{numeroAffiche(d.whatsappE164)}</strong> vont être supprimées
            définitivement, avec leur historique, leurs notes et les e-mails envoyés à leur sujet&nbsp;:
          </p>
          <ul>
            {liste.map((l) => (
              <li key={l.reference}>
                {l.reference} · {LIBELLES_TYPE[l.type]} · {LIBELLES_STATUT[l.statut]} · {dateHeure(l.creeLe)}
              </li>
            ))}
          </ul>
          <p>Cette action est irréversible. Le journal ne gardera que le nombre de demandes supprimées.</p>
          <Formulaire action={confirmerSuppressionClient} bouton="Supprimer définitivement" boutonClasse="btn btn--danger">
            <input type="hidden" name="reference" value={d.reference} />
            <label className="case">
              <input type="checkbox" name="confirmation" value="1" required />
              <span>Je confirme que le client a demandé la suppression de ses données.</span>
            </label>
          </Formulaire>
        </div>
      )}
    </Cadre>
  );
}
