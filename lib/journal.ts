// Journal applicatif : une ligne JSON par événement (lisible dans les « Runtime
// Logs » de Hostinger). Règle : jamais de donnée personnelle (nom, numéro, lieu,
// adresse IP, e-mail) ; seulement des identifiants internes, des références de
// demande et des codes d’erreur.

type Niveau = "info" | "avertissement" | "erreur";
type Donnees = Record<string, string | number | boolean | null | undefined>;

function ecrire(niveau: Niveau, message: string, donnees?: Donnees) {
  const ligne = JSON.stringify({ le: new Date().toISOString(), niveau, message, ...donnees });
  if (niveau === "erreur") console.error(ligne);
  else if (niveau === "avertissement") console.warn(ligne);
  else console.log(ligne);
}

export const journal = {
  info: (message: string, donnees?: Donnees) => ecrire("info", message, donnees),
  avertissement: (message: string, donnees?: Donnees) => ecrire("avertissement", message, donnees),
  erreur: (message: string, donnees?: Donnees) => ecrire("erreur", message, donnees),
};

/**
 * Résumé d’une erreur sans son message (qui peut contenir une adresse e-mail,
 * un chemin ou une requête) : nom, code et code de réponse SMTP éventuels.
 */
export function codeErreur(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { name?: unknown; code?: unknown; errno?: unknown; responseCode?: unknown };
    const morceaux = [
      typeof o.code === "string" || typeof o.code === "number" ? String(o.code) : typeof o.name === "string" ? o.name : "Erreur",
      typeof o.responseCode === "number" ? `SMTP ${o.responseCode}` : undefined,
      typeof o.errno === "number" && typeof o.code !== "string" ? `errno ${o.errno}` : undefined,
    ];
    return morceaux.filter(Boolean).join(" · ").slice(0, 200);
  }
  return "Erreur";
}
