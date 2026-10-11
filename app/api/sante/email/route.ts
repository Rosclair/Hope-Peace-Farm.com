// Envoi d’un e-mail de test à NOTIFICATION_EMAIL, par la file d’envoi
// (jeton DIAGNOSTIC_SECRET obligatoire).

import { connection } from "next/server";
import { codeErreur } from "@/lib/journal";
import { envoyerEmail, mettreEnFile } from "@/lib/mail/file";
import { adresseNotification } from "@/lib/mail/transport";
import { accesAutorise, SANS_CACHE } from "@/lib/securite/acces";
import { identifiantBuild } from "@/lib/serveur/build";

export async function POST(requete: Request) {
  await connection();
  if (!accesAutorise(requete, "DIAGNOSTIC_SECRET")) {
    return Response.json({ erreur: "non autorisé" }, { status: 401, headers: SANS_CACHE });
  }
  try {
    const le = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala", dateStyle: "full", timeStyle: "medium" });
    const id = await mettreEnFile({
      type: "test",
      destinataire: adresseNotification(),
      sujet: "Hope & Peace Farm — e-mail de test",
      texte: [
        "Bonjour,",
        "",
        "Ceci est un e-mail de test envoyé par le site Hope & Peace Farm, pour vérifier la configuration SMTP.",
        `Envoyé le ${le} (heure de Douala), compilation ${identifiantBuild()}.`,
        "",
        "Aucune action n’est nécessaire.",
      ].join("\n"),
    });
    const resultat = await envoyerEmail(id);
    return Response.json({ email: id, resultat }, { status: resultat === "envoye" ? 200 : 502, headers: SANS_CACHE });
  } catch (e) {
    return Response.json({ erreur: codeErreur(e) }, { status: 500, headers: SANS_CACHE });
  }
}
