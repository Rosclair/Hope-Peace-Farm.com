// Masquage des valeurs sensibles au journal d’audit et dans les e-mails d’alerte
// (brief §4.9) : numéros et adresses e-mail réduits à ce qui permet de les reconnaître.

/** Champs du contenu et réglages dont la valeur est masquée au journal. */
export const CHEMINS_SENSIBLES = new Set([
  "coordonnees.whatsapp",
  "coordonnees.telephone",
  "coordonnees.emailContact",
  "paiement.mtn",
  "paiement.orange",
  "paiement.nomCompte",
  "reglage.emailNotification",
]);

/** « +237 6•• •• 55 65 » : indicatif, premier chiffre et quatre derniers chiffres. */
export function masquerNumero(valeur: string): string {
  const chiffres = valeur.replace(/\D/g, "");
  if (chiffres.length < 6) return "••••";
  const fin = chiffres.slice(-4);
  const national = chiffres.startsWith("237") ? chiffres.slice(3) : chiffres;
  const prefixe = chiffres.startsWith("237") ? "+237 " : "+";
  return `${prefixe}${national[0]}•• •• ${fin.slice(0, 2)} ${fin.slice(2)}`;
}

/** « i•••@gmail.com ». */
export function masquerEmail(valeur: string): string {
  const [local, domaine] = valeur.split("@");
  if (!local || !domaine) return "•••";
  return `${local[0]}•••@${domaine}`;
}

/** Valeur telle qu’elle apparaît au journal. */
export function valeurJournal(chemin: string, valeur: unknown): unknown {
  if (!CHEMINS_SENSIBLES.has(chemin) || typeof valeur !== "string" || valeur === "") return valeur;
  if (valeur.includes("@")) return masquerEmail(valeur);
  if (/\d{6,}/.test(valeur.replace(/\D/g, ""))) return masquerNumero(valeur);
  return "•••";
}
