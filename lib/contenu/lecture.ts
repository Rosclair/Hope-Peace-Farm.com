// Contenu publié, tel que la page publique le rend (architecture §4).
//
// Mise en cache (« use cache ») étiquetée ETIQUETTE_CONTENU, avec le profil
// PROFIL_CONTENU : la publication invalide l’étiquette (effet immédiat) et, en
// plus, le contenu est relu au plus toutes les 30 s (en arrière-plan) et jamais
// servi s’il a plus de 5 min. Cette borne couvre ce que l’étiquette ne couvre pas :
// Next garde l’état des étiquettes en mémoire, perdu au redémarrage du processus
// (Hostinger l’arrête après une période sans trafic).
//
// Repli si la base est indisponible (compilation chez l’hébergeur, panne) : le
// dernier contenu publié gardé sur disque (instantane.ts), sinon celui de la maquette.

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { codeErreur, journal } from "@/lib/journal";
import { lireVersionEnLigne } from "./depot";
import { CONTENU_INITIAL } from "./initial";
import { ecrireInstantane, lireInstantane } from "./instantane";
import { ETIQUETTE_CONTENU, PROFIL_CONTENU } from "./profil";
import { schemaContenu } from "./schema";
import type { ContenuPage } from "./types";

export type SourceContenu = "base" | "instantane" | "maquette";

/** Base injoignable récemment : on ne réessaie pas à chaque appel (délai de connexion de 10 s). */
let baseInjoignableJusqua = 0;

export async function chargerContenuPublie(): Promise<{ contenu: ContenuPage; source: SourceContenu; numero: number | null }> {
  if (Date.now() >= baseInjoignableJusqua) {
    try {
      const version = await lireVersionEnLigne();
      if (version) {
        const analyse = schemaContenu.safeParse(version.donnees);
        if (analyse.success) {
          await ecrireInstantane(version.numero, version.empreinte, analyse.data);
          return { contenu: analyse.data, source: "base", numero: version.numero };
        }
        journal.erreur("version en ligne invalide", { numero: version.numero, problemes: analyse.error.issues.length });
      } else {
        journal.avertissement("aucune version en ligne : contenu non initialisé");
      }
    } catch (e) {
      baseInjoignableJusqua = Date.now() + 30_000;
      journal.erreur("lecture du contenu publié impossible", { erreur: codeErreur(e) });
    }
  }
  const instantane = await lireInstantane();
  if (instantane) return { contenu: instantane.donnees, source: "instantane", numero: instantane.numero };
  return { contenu: CONTENU_INITIAL, source: "maquette", numero: null };
}

/** Contenu publié, mis en cache. Seule entrée utilisée par la page publique. */
export async function contenuPublie(): Promise<ContenuPage> {
  "use cache";
  cacheTag(ETIQUETTE_CONTENU);
  cacheLife(PROFIL_CONTENU);
  return (await chargerContenuPublie()).contenu;
}
