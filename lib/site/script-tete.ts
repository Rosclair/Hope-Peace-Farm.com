// Script de tête de la maquette (reference/extrait/tete.js), repris à
// l’identique : pose `js`, `motion`, `scrolly` et les classes des Fêtes sur
// <html> avant le premier rendu. Toute modification change son empreinte CSP.

export const SCRIPT_TETE =
  '(function(h){h.className=h.className.replace("no-js","js");try{var d=h.dataset,t=new Date(Date.now()+36e5).toISOString().slice(0,10);if(d.fetesEnd&&t>d.fetesEnd)h.classList.add("fetes-fin");else if(d.fetesDeadline&&t<d.fetesDeadline)h.classList.add("fetes-garanti");if(window.matchMedia&&matchMedia("(prefers-reduced-motion: no-preference)").matches){h.classList.add("motion");if(window.innerHeight>=600&&window.innerWidth>=300&&"IntersectionObserver"in window&&window.CSS&&CSS.supports("position","sticky"))h.classList.add("scrolly")}}catch(e){}})(document.documentElement);';
