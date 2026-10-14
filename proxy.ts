// Proxy (ex-middleware) : redirections d’accès du back-office au niveau HTTP.
//
// Les pages /admin sont rendues en flux : un redirect() décidé pendant le rendu n’atteint
// le navigateur que par JavaScript. Pour qu’un visiteur sans JavaScript (ou un lien
// ouvert depuis un e-mail) soit bien redirigé, la session est vérifiée ici, avant le
// rendu (requêtes GET seulement). Ce n’est qu’un premier filtre : chaque page et chaque
// action serveur revérifient le compte et le rôle (lib/auth/session.ts).

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/serveur";

/** Pages accessibles sans session. */
const PUBLIQUES = [/^\/admin\/connexion(\/code)?$/, /^\/admin\/invitation\/[^/]+$/];
/** Rubriques réservées au propriétaire. */
const PROPRIETAIRE = [/^\/admin\/contenus(\/|$)/, /^\/admin\/publier(\/|$)/, /^\/admin\/reglages(\/|$)/, /^\/admin\/apercu(\/|$)/];
const ACTIVATION = "/admin/securite/activer";

export async function proxy(requete: NextRequest) {
  if (requete.method !== "GET" && requete.method !== "HEAD") return NextResponse.next();
  const chemin = requete.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const vers = (cible: string) => NextResponse.redirect(new URL(cible, requete.url), 303);

  let compte: { deuxFacteurs: boolean; proprietaire: boolean } | null = null;
  try {
    const s = await auth().api.getSession({ headers: requete.headers });
    const u = s?.user as { actif?: boolean; role?: string; twoFactorEnabled?: boolean | null } | undefined;
    if (s && u && u.actif !== false) compte = { deuxFacteurs: Boolean(u.twoFactorEnabled), proprietaire: u.role === "proprietaire" };
  } catch {
    // Base indisponible : la page affichera l’erreur ou redirigera elle-même.
    return NextResponse.next();
  }

  const publique = PUBLIQUES.some((m) => m.test(chemin));
  if (!compte) return publique ? NextResponse.next() : vers("/admin/connexion");
  if (!compte.deuxFacteurs) return chemin === ACTIVATION || publique ? NextResponse.next() : vers(ACTIVATION);
  if (chemin === ACTIVATION || /^\/admin\/connexion(\/|$)/.test(chemin)) return vers("/admin");
  if (!compte.proprietaire && PROPRIETAIRE.some((m) => m.test(chemin))) return vers("/admin?refus=1");
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:chemin*"],
};
