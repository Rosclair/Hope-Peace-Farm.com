// Mise en forme des dates du back-office, à l’heure de Douala.

import { telephoneAffiche } from "@/lib/contenu/format";

const FORMAT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Douala",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** « 14/10/2026 09:05 ». */
export function dateHeure(d: Date): string {
  return FORMAT.format(d).replace(",", "");
}

/** « il y a 3 h », « il y a 2 j ». */
export function depuis(d: Date, maintenant = Date.now()): string {
  const minutes = Math.max(0, Math.round((maintenant - d.getTime()) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.round(heures / 24)} j`;
}

/** Numéro E.164 (« +237693645565 ») affiché comme sur le site. */
export const numeroAffiche = (e164: string) => telephoneAffiche(e164.replace(/^\+/, ""));
