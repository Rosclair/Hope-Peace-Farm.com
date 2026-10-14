"use client";

// Éditeur d’un groupe de contenus : champs déduits du schéma (libellé, aide, longueur
// maximale, obligatoire), rendu final sous les textes qui citent une valeur
// ({delais.devis}), badge « à confirmer », erreurs rapportées au champ. Sans
// JavaScript, le formulaire s’envoie quand même (action serveur).

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Retour } from "@/components/admin/formulaire";
import type { Champ } from "@/lib/admin/champs";
import { enregistrerGroupe, type EtatEditeur } from "./actions";

const idDe = (chemin: string) => `ch-${chemin.replace(/[^a-zA-Z0-9]+/g, "-")}`;
const premierNiveau = (chemin: string) => (chemin.match(/^[a-zA-Z]+\.[a-zA-Z]+/)?.[0] ?? chemin);

/** Rendu final d’un texte : repères remplacés, **gras** et [lien](#ancre) réduits à leur texte. */
function rendu(texte: string, reperes: Record<string, string>): string {
  return texte
    .replace(/\{([a-zA-Z]+\.[a-zA-Z]+)\}/g, (m, c: string) => reperes[c] ?? m)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((#[a-z0-9-]+)\)/g, "$1");
}

interface Props {
  groupe: string;
  champs: Champ[];
  valeurs: Record<string, string>;
  aConfirmer: string[];
  revision: number;
  sensibles: string[];
  reperes: Record<string, string>;
}

export function Editeur(p: Props) {
  const [etat, envoyer, enCours] = useActionState(enregistrerGroupe, { revision: p.revision, aConfirmer: p.aConfirmer } as EtatEditeur);
  const [valeurs, setValeurs] = useState(p.valeurs);
  const erreurs = new Map((etat.erreurs ?? []).map((e) => [e.chemin, e.message]));
  const aConfirmer = new Set(etat.aConfirmer ?? p.aConfirmer);
  const revision = etat.revision ?? p.revision;

  const soumettre = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    startTransition(() => envoyer(donnees));
  };
  const changer = (chemin: string, v: string) => setValeurs((a) => ({ ...a, [chemin]: v }));

  const caseConfirmer = (chemin: string) => (
    <label className="case discret">
      <input type="checkbox" name="_confirmer" value={chemin} defaultChecked={aConfirmer.has(chemin)} key={`${chemin}:${revision}`} />
      <span>À confirmer</span>
    </label>
  );

  const rendre = (c: Champ, profondeur: number) => {
    const id = idDe(c.chemin);
    const erreur = erreurs.get(c.chemin);
    const marquable = premierNiveau(c.chemin) === c.chemin;
    const badge = marquable && aConfirmer.has(c.chemin) ? <span className="pastille pastille--confirmer">à confirmer</span> : null;

    if (c.genre === "groupe") {
      return (
        <fieldset key={c.chemin} id={id}>
          <legend>
            {c.libelle} {badge}
          </legend>
          {c.aide && <span className="aide">{c.aide}</span>}
          {erreur && <span className="erreur-champ">{erreur}</span>}
          {marquable && caseConfirmer(c.chemin)}
          {c.enfants.map((e) => rendre(e, profondeur + 1))}
        </fieldset>
      );
    }

    const v = valeurs[c.chemin] ?? "";
    const aideId = c.aide ? `${id}-aide` : undefined;
    const erreurId = erreur ? `${id}-erreur` : undefined;
    const decrit = [aideId, erreurId].filter(Boolean).join(" ") || undefined;
    const commun = { id, name: c.chemin, "aria-invalid": erreur ? true : undefined, "aria-describedby": decrit } as const;
    let saisie;
    switch (c.genre) {
      case "booleen":
        return (
          <div className="champ" key={c.chemin}>
            <label className="case">
              <input type="checkbox" {...commun} value="1" checked={v === "1"} onChange={(e) => changer(c.chemin, e.target.checked ? "1" : "")} />
              <span>
                {c.libelle} {badge}
              </span>
            </label>
            {c.aide && <span className="aide" id={aideId}>{c.aide}</span>}
            {erreur && <span className="erreur-champ" id={erreurId}>{erreur}</span>}
            {marquable && caseConfirmer(c.chemin)}
          </div>
        );
      case "entier":
        saisie = <input type="text" inputMode="numeric" {...commun} value={v} onChange={(e) => changer(c.chemin, e.target.value)} />;
        break;
      case "date":
        saisie = <input type="date" {...commun} value={v} onChange={(e) => changer(c.chemin, e.target.value)} required />;
        break;
      case "choix":
        saisie = (
          <select {...commun} value={v} onChange={(e) => changer(c.chemin, e.target.value)}>
            {c.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
        break;
      default:
        saisie = c.long ? (
          <textarea {...commun} value={v} maxLength={c.max} required={c.requis} onChange={(e) => changer(c.chemin, e.target.value)} rows={Math.min(10, Math.max(3, Math.ceil(v.length / 60)))} />
        ) : (
          <input type="text" {...commun} value={v} maxLength={c.max} required={c.requis} onChange={(e) => changer(c.chemin, e.target.value)} />
        );
    }
    const final = c.genre === "texte" && /[{*[]/.test(v) ? rendu(v, p.reperes) : null;
    return (
      <div className="champ" key={c.chemin}>
        <label htmlFor={id}>
          {c.libelle} {c.genre === "texte" && !c.requis ? <span className="discret">(facultatif)</span> : null} {badge}
        </label>
        {c.aide && (
          <span className="aide" id={aideId}>
            {c.aide}
          </span>
        )}
        {saisie}
        {c.genre === "texte" && c.max ? (
          <span className="discret">
            {v.length} / {c.max}
          </span>
        ) : null}
        {erreur && (
          <span className="erreur-champ" id={erreurId}>
            {erreur}
          </span>
        )}
        {final !== null && (
          <div className="rendu" aria-label="Rendu sur le site">
            <span className="discret">Sur le site&nbsp;: </span>
            {final}
          </div>
        )}
        {marquable && caseConfirmer(c.chemin)}
      </div>
    );
  };

  return (
    <form action={envoyer} onSubmit={soumettre} noValidate>
      <input type="hidden" name="_groupe" value={p.groupe} />
      <input type="hidden" name="_revision" value={revision} />
      <Retour etat={etat} />
      {p.champs.map((c) => rendre(c, 0))}
      {p.sensibles.length > 0 && (
        <div className="carte">
          <div className="champ">
            <label htmlFor="ch-code">Code de sécurité (si vous changez {p.sensibles.join(" ou ")})</label>
            <span className="aide" id="ch-code-aide">
              Les 6 chiffres de votre application d’authentification. Un e-mail d’alerte sera envoyé.
            </span>
            <input id="ch-code" name="_code" type="text" inputMode="numeric" autoComplete="one-time-code" aria-describedby="ch-code-aide" aria-invalid={erreurs.has("_code") || undefined} />
            {erreurs.has("_code") && <span className="erreur-champ">{erreurs.get("_code")}</span>}
          </div>
        </div>
      )}
      <div className="actions">
        <button className="btn" type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer dans le brouillon"}
        </button>
      </div>
    </form>
  );
}
