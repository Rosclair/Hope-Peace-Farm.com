// Icône du sprite de la maquette : <svg class="icon" aria-hidden="true"><use href="#i-…"></use></svg>.

import type { Icone as NomIcone } from "@/lib/contenu/types";

export function Icone({ id, classe = "icon", masquee = true }: { id: NomIcone; classe?: string; masquee?: boolean }) {
  return (
    <svg className={classe} aria-hidden={masquee ? "true" : undefined}>
      <use href={`#${id}`}></use>
    </svg>
  );
}

/** Logo complet (symbole #logo du sprite), décoratif. */
export function Logo({ classe }: { classe?: string }) {
  return (
    <svg className={classe} aria-hidden="true" focusable="false">
      <use href="#logo" />
    </svg>
  );
}
