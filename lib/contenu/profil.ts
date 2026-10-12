// Durées de cache des rendus qui dépendent du contenu publié ou de la date (secondes) :
// relecture en arrière-plan au plus toutes les 30 s, jamais servi au-delà de 5 min.
// `expire` reste à 5 min : en dessous, Next exclurait la page du pré-rendu
// (documentation de cacheLife). La publication, elle, invalide le cache tout de suite.

export const PROFIL_CONTENU = { stale: 300, revalidate: 30, expire: 300 } as const;

/** Étiquette de cache du contenu publié (invalidée à chaque publication). */
export const ETIQUETTE_CONTENU = "contenu-publie";
