"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatAction } from "@/lib/admin/etat";
import { etapeCode, etapeMotDePasse } from "@/lib/auth/connexion";

const schemaConnexion = z.object({
  email: z.email().max(254),
  motDePasse: z.string().min(1).max(128),
});

export async function connexion(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const email = String(donnees.get("email") ?? "").trim();
  const analyse = schemaConnexion.safeParse({ email, motDePasse: donnees.get("motDePasse") });
  if (!analyse.success) return { erreur: "Saisissez votre e-mail et votre mot de passe.", valeurs: { email } };
  const r = await etapeMotDePasse(analyse.data.email, analyse.data.motDePasse, await headers());
  if (r.statut === "code") redirect("/admin/connexion/code");
  if (r.statut === "activer") redirect("/admin/securite/activer");
  if (r.statut === "connecte") redirect("/admin");
  return { erreur: r.message, valeurs: { email } };
}

export async function verifierCode(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const code = z.string().trim().min(6).max(40).safeParse(donnees.get("code"));
  if (!code.success) return { erreur: "Saisissez le code à 6 chiffres de votre application, ou un code de secours." };
  const r = await etapeCode(code.data, await headers());
  if (r.statut === "connecte") redirect("/admin");
  return { erreur: r.statut === "erreur" ? r.message : "Reprenez la connexion depuis le début." };
}
