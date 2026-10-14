// Normalisation du « Numéro WhatsApp » des formulaires (brief §3). Module pur,
// partagé par le serveur (validation, limites de débit) et le moteur du navigateur
// (vérification avant l’envoi) : les deux appliquent exactement la même règle.
//
// Règle : retirer espaces, points, tirets et parenthèses ; « 00 » devient « + » ;
// neuf chiffres commençant par 6 ou 2 reçoivent +237 ; « + » suivi de 8 à 15
// chiffres est accepté (diaspora). Ajout prudent : « 237 » suivi de neuf chiffres
// (indicatif tapé sans « + ») est lu comme +237. Un numéro +237 doit avoir neuf
// chiffres commençant par 6 ou 2.

/** Numéro au format E.164 (« +237693645565 »), ou null s’il n’est pas valide. */
export function normaliserNumero(brut: string): string | null {
  let n = String(brut ?? "").replace(/[\s.\-()  ]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  if (/^[62]\d{8}$/.test(n)) n = `+237${n}`;
  else if (/^237[62]\d{8}$/.test(n)) n = `+${n}`;
  if (!/^\+[1-9]\d{7,14}$/.test(n)) return null;
  if (n.startsWith("+237") && !/^\+237[62]\d{8}$/.test(n)) return null;
  return n;
}

/** Chiffres seuls, pour un lien wa.me (« 237693645565 »). */
export const chiffresWa = (e164: string) => e164.replace(/\D/g, "");

