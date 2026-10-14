import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageSeule } from "@/components/admin/cadre";
import { exigerSession } from "@/lib/auth/session";
import { Activation } from "./activation";

export const metadata: Metadata = { title: "Activer le second facteur" };

export default async function PageActivation() {
  const compte = await exigerSession();
  if (compte.deuxFacteurs) redirect("/admin");
  return (
    <PageSeule>
      <h1>Sécurisez votre compte</h1>
      <p>
        Le back-office demande, en plus du mot de passe, un code à 6 chiffres donné par une application sur votre téléphone.
        Cette étape est obligatoire.
      </p>
      <Activation />
    </PageSeule>
  );
}
