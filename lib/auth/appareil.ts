// Résumé de l’appareil d’une session (« Chrome · Android ») : assez pour reconnaître
// ses sessions et révoquer celle d’un téléphone perdu, sans garder l’agent complet.

const NAVIGATEURS: [RegExp, string][] = [
  [/SamsungBrowser\//, "Samsung Internet"],
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/OPR\/|Opera/, "Opera"],
  [/Edg\//, "Edge"],
  [/Firefox\/|FxiOS/, "Firefox"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMES: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function resumeAppareil(agent: string | null | undefined): string {
  if (!agent) return "Appareil inconnu";
  const navigateur = NAVIGATEURS.find(([motif]) => motif.test(agent))?.[1] ?? "Navigateur";
  const systeme = SYSTEMES.find(([motif]) => motif.test(agent))?.[1];
  return systeme ? `${navigateur} · ${systeme}` : navigateur;
}
