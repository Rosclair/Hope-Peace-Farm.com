// Colonnes communes aux tables : identifiant, horodatages en UTC à la milliseconde
// (session forcée à +00:00 dans client.ts) et documents JSON.

import { sql } from "drizzle-orm";
import { bigint, customType, datetime } from "drizzle-orm/mysql-core";

export const maintenant = sql`CURRENT_TIMESTAMP(3)`;
export const horodatage = (nom: string) => datetime(nom, { mode: "date", fsp: 3 });
export const identifiant = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();

/**
 * Document JSON. MySQL renvoie un objet, MariaDB (où JSON est un texte long) une
 * chaîne : les deux sont relus en objet. Le contenu est validé par Zod à la lecture.
 */
export const documentJson = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return "json";
  },
  toDriver(valeur) {
    return JSON.stringify(valeur);
  },
  fromDriver(valeur) {
    return typeof valeur === "string" ? JSON.parse(valeur) : valeur;
  },
});
