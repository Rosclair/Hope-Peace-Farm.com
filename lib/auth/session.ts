// Accès aux données du compte connecté (couche d’accès, architecture §9). Chaque page
// et chaque action serveur du back-office appelle `exigerCompte` : les rôles sont
// vérifiés côté serveur, pas seulement dans le menu.

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Role } from "@/lib/db/schema";
import { auth } from "./serveur";

export interface Compte {
  id: string;
  nom: string;
  email: string;
  role: Role;
  sessionId: string;
  deuxFacteurs: boolean;
}

/** Session valide d’un compte actif, ou null. Lue une fois par requête. */
export const lireCompte = cache(async (): Promise<Compte | null> => {
  // Rendu à la requête seulement (la validité de la session dépend de l’heure).
  await connection();
  const entetes = await headers();
  const s = await auth()
    .api.getSession({ headers: entetes })
    .catch(() => null);
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; actif?: boolean; twoFactorEnabled?: boolean | null };
  if (u.actif === false) return null;
  return {
    id: u.id,
    nom: u.name,
    email: u.email,
    role: u.role === "proprietaire" ? "proprietaire" : "equipe",
    sessionId: s.session.id,
    deuxFacteurs: Boolean(u.twoFactorEnabled),
  };
});

/**
 * Compte connecté, avec le second facteur activé et le rôle demandé ; sinon
 * redirection (connexion, activation du TOTP ou tableau de bord).
 */
export async function exigerCompte(role?: Role): Promise<Compte> {
  const compte = await lireCompte();
  if (!compte) redirect("/admin/connexion");
  if (!compte.deuxFacteurs) redirect("/admin/securite/activer");
  if (role === "proprietaire" && compte.role !== "proprietaire") redirect("/admin?refus=1");
  return compte;
}

/** Comme `exigerCompte`, sans exiger le second facteur (page d’activation du TOTP). */
export async function exigerSession(): Promise<Compte> {
  const compte = await lireCompte();
  if (!compte) redirect("/admin/connexion");
  return compte;
}
