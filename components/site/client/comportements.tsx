"use client";

// Seul composant client de la page : après l’hydratation, il lance une fois les
// formulaires du moteur (lib/moteur) et ne rend rien. La partie immédiate du moteur
// (landing, apparitions, menu, barre fixe…) tourne déjà, en ligne, depuis la fin de
// <body>. Aucune donnée de défilement ne passe par l’état React.

import { useEffect } from "react";
import { demarrerApresHydratation } from "@/lib/moteur";

export function Comportements() {
  useEffect(() => {
    void demarrerApresHydratation();
  }, []);
  return null;
}
