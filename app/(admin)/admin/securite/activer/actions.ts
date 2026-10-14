"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { qrSvg, secretLisible } from "@/lib/admin/qr";
import { ecrireAudit } from "@/lib/audit";
import { exigerSession } from "@/lib/auth/session";
import { auth } from "@/lib/auth/serveur";

export interface EtatActivation {
  erreur?: string;
  qr?: string;
  secret?: string;
  codes?: string[];
}

/** Étape 1 : mot de passe → secret TOTP (QR code) et 10 codes de secours. */
export async function preparerTotp(_e: EtatActivation, donnees: FormData): Promise<EtatActivation> {
  const compte = await exigerSession();
  if (compte.deuxFacteurs) redirect("/admin");
  const motDePasse = z.string().min(1).max(128).safeParse(donnees.get("motDePasse"));
  if (!motDePasse.success) return { erreur: "Saisissez votre mot de passe." };
  try {
    const r = await auth().api.enableTwoFactor({ body: { password: motDePasse.data }, headers: await headers() });
    if (!("totpURI" in r) || !r.totpURI) return { erreur: "Activation impossible pour le moment." };
    return { qr: qrSvg(r.totpURI), secret: secretLisible(r.totpURI), codes: r.backupCodes ?? [] };
  } catch {
    return { erreur: "Mot de passe incorrect." };
  }
}

/** Étape 2 : premier code de l’application → second facteur activé. */
export async function confirmerTotp(_e: { erreur?: string }, donnees: FormData): Promise<{ erreur?: string }> {
  const compte = await exigerSession();
  if (compte.deuxFacteurs) redirect("/admin");
  const code = z.string().trim().regex(/^\d{6}$/).safeParse(String(donnees.get("code") ?? "").replace(/\s+/g, ""));
  if (!code.success) return { erreur: "Saisissez le code à 6 chiffres affiché par l’application." };
  const entetes = await headers();
  try {
    await auth().api.verifyTOTP({ body: { code: code.data }, headers: entetes });
  } catch {
    return { erreur: "Code incorrect. Vérifiez l’heure du téléphone et réessayez." };
  }
  await ecrireAudit({ utilisateurId: compte.id, action: "securite.totp_active", cibleType: "utilisateur", cibleId: compte.id, entetes });
  redirect("/admin?bienvenue=1");
}
