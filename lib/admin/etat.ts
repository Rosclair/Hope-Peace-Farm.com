// Résultat d’une action serveur du back-office, affiché par <Formulaire>.

export interface ErreurChamp {
  chemin: string;
  libelle?: string;
  message: string;
}

export interface EtatAction {
  ok?: string;
  details?: string[];
  erreur?: string;
  erreurs?: ErreurChamp[];
  /** Valeurs à remettre dans le formulaire après une erreur. */
  valeurs?: Record<string, string>;
  /** Numéro de l’envoi, pour remettre le formulaire à zéro après un succès. */
  envoi?: number;
}
