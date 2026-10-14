"use server";

// Actions communes du back-office.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ecrireAudit } from "@/lib/audit";
import { lireCompte } from "@/lib/auth/session";
import { auth } from "@/lib/auth/serveur";

export async function seDeconnecter(): Promise<void> {
  const entetes = await headers();
  const compte = await lireCompte();
  await auth()
    .api.signOut({ headers: entetes })
    .catch(() => undefined);
  if (compte) await ecrireAudit({ utilisateurId: compte.id, action: "connexion.deconnexion", cibleType: "session", cibleId: compte.sessionId, entetes });
  redirect("/admin/connexion");
}
