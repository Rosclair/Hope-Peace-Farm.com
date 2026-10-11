// Page témoin du cache (phase 1) : rendue une fois puis servie depuis le cache,
// jusqu’à la revalidation de l’étiquette « diagnostic-cache » (POST
// /api/sante/cache). Vérifie sur l’hébergeur le mécanisme que la publication
// du back-office utilisera (phase 3).

import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";

export const metadata: Metadata = { title: "Diagnostic du cache", robots: { index: false, follow: false } };

async function horodatage() {
  "use cache";
  cacheTag("diagnostic-cache");
  cacheLife("max");
  return new Date().toISOString();
}

export default async function DiagnosticCache() {
  const le = await horodatage();
  return (
    <main className="squelette">
      <p data-horodatage={le}>Page mise en cache le {le}.</p>
    </main>
  );
}
