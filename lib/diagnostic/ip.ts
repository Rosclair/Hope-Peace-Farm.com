// Analyse des en-têtes qui peuvent porter l’adresse IP du visiteur derrière le
// proxy de l’hébergeur. Les adresses sont tronquées : le diagnostic montre quel
// en-tête est fiable sans jamais afficher une adresse complète.

const ENTETES_IP = ["x-forwarded-for", "x-real-ip", "forwarded", "cf-connecting-ip", "true-client-ip", "x-client-ip", "x-cluster-client-ip"];

/** Deux premiers octets (IPv4) ou deux premiers groupes (IPv6), le reste masqué. */
export function tronquerIp(adresse: string): string {
  const a = adresse
    .trim()
    .replace(/^for=/i, "")
    .replace(/^"|"$/g, "")
    .replace(/^\[([^\]]+)\](:\d+)?$/, "$1");
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(a)) return a.split(".").slice(0, 2).join(".") + ".x.x";
  if (/^[0-9a-f:]+$/i.test(a) && a.includes(":")) return a.split(":").slice(0, 2).join(":") + ":…";
  return "?";
}

export function analyserEntetesIp(entetes: Headers): Record<string, string[]> {
  const resultat: Record<string, string[]> = {};
  for (const nom of ENTETES_IP) {
    const valeur = entetes.get(nom);
    if (!valeur) continue;
    resultat[nom] = valeur
      .split(/[,;]\s*/)
      .filter((v) => v.trim() !== "" && !/^(proto|host|by)=/i.test(v.trim()))
      .map(tronquerIp);
  }
  return resultat;
}
