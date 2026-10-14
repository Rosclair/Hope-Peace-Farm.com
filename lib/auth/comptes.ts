// Comptes du back-office : création (premier propriétaire en ligne de commande,
// membres par invitation), désactivation, sessions actives. Les mots de passe sont
// hachés par Better Auth (scrypt).

import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invitation, session, utilisateur, type Role } from "@/lib/db/schema";
import { auth } from "./serveur";

export const LONGUEUR_MIN_MOT_DE_PASSE = 12;
export const INVITATION_JOURS = 7;

export class CompteExistant extends Error {
  constructor() {
    super("Un compte existe déjà avec cette adresse e-mail.");
    this.name = "CompteExistant";
  }
}

/** Règle du mot de passe : 12 caractères au moins, pas une simple répétition. */
export function problemeMotDePasse(motDePasse: string, email?: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins.`;
  if (motDePasse.length > 128) return "128 caractères au plus.";
  if (new Set(motDePasse).size < 5) return "Trop simple : variez les caractères.";
  if (email && motDePasse.toLowerCase().includes(email.split("@")[0]!.toLowerCase())) return "Ne reprenez pas votre adresse e-mail.";
  return null;
}

export async function creerCompte(args: { email: string; nom: string; role: Role; motDePasse: string }): Promise<string> {
  const email = args.email.trim().toLowerCase();
  const [existant] = await db().select({ id: utilisateur.id }).from(utilisateur).where(eq(utilisateur.email, email)).limit(1);
  if (existant) throw new CompteExistant();
  const ctx = await auth().$context;
  const hache = await ctx.password.hash(args.motDePasse);
  const u = await ctx.internalAdapter.createUser({ email, name: args.nom.trim(), emailVerified: true }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: hache });
  await db().update(utilisateur).set({ role: args.role, actif: true }).where(eq(utilisateur.id, u.id));
  return u.id;
}

export async function nombreProprietaires(): Promise<number> {
  const lignes = await db()
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(and(eq(utilisateur.role, "proprietaire"), eq(utilisateur.actif, true)));
  return lignes.length;
}

export async function listeComptes() {
  return db()
    .select({
      id: utilisateur.id,
      nom: utilisateur.name,
      email: utilisateur.email,
      role: utilisateur.role,
      actif: utilisateur.actif,
      deuxFacteurs: utilisateur.twoFactorEnabled,
      verrouilleJusqua: utilisateur.verrouilleJusqua,
      creeLe: utilisateur.createdAt,
    })
    .from(utilisateur)
    .orderBy(utilisateur.createdAt);
}

/** Désactive ou réactive un compte ; la désactivation ferme ses sessions. */
export async function changerActivation(id: string, actif: boolean): Promise<void> {
  await db().update(utilisateur).set({ actif, echecsConnexion: 0, verrouilleJusqua: null }).where(eq(utilisateur.id, id));
  if (!actif) await db().delete(session).where(eq(session.userId, id));
}

// ---------------------------------------------------------------------------
// Sessions actives

export async function sessionsActives(utilisateurId: string) {
  return db()
    .select({ id: session.id, appareil: session.userAgent, creeLe: session.createdAt, majLe: session.updatedAt, expireLe: session.expiresAt })
    .from(session)
    .where(and(eq(session.userId, utilisateurId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt));
}

/** Révoque une session du compte (jamais celle d’un autre compte). */
export async function revoquerSession(utilisateurId: string, sessionId: string): Promise<boolean> {
  const [r] = await db()
    .delete(session)
    .where(and(eq(session.id, sessionId), eq(session.userId, utilisateurId)));
  return r.affectedRows === 1;
}

// ---------------------------------------------------------------------------
// Invitations : lien à usage unique, valable 7 jours ; seule l’empreinte du jeton est gardée.

const empreinteJeton = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

export async function creerInvitation(args: { email: string; nom: string; role: Role; par: string }): Promise<string> {
  const email = args.email.trim().toLowerCase();
  const [existant] = await db().select({ id: utilisateur.id }).from(utilisateur).where(eq(utilisateur.email, email)).limit(1);
  if (existant) throw new CompteExistant();
  const jeton = randomBytes(24).toString("base64url");
  await db()
    .insert(invitation)
    .values({
      id: randomUUID(),
      email,
      nom: args.nom.trim(),
      role: args.role,
      jetonEmpreinte: empreinteJeton(jeton),
      expireLe: new Date(Date.now() + INVITATION_JOURS * 864e5),
      creePar: args.par,
    });
  return jeton;
}

export async function lireInvitation(jeton: string) {
  if (!/^[\w-]{20,64}$/.test(jeton)) return null;
  const [inv] = await db()
    .select()
    .from(invitation)
    .where(and(eq(invitation.jetonEmpreinte, empreinteJeton(jeton)), isNull(invitation.accepteeLe), gt(invitation.expireLe, new Date())))
    .limit(1);
  return inv ?? null;
}

/** Accepte l’invitation : crée le compte, puis marque l’invitation utilisée. */
export async function accepterInvitation(jeton: string, motDePasse: string): Promise<{ id: string; email: string } | null> {
  const inv = await lireInvitation(jeton);
  if (!inv) return null;
  const [r] = await db()
    .update(invitation)
    .set({ accepteeLe: new Date() })
    .where(and(eq(invitation.id, inv.id), isNull(invitation.accepteeLe)));
  if (r.affectedRows !== 1) return null;
  const id = await creerCompte({ email: inv.email, nom: inv.nom, role: inv.role, motDePasse });
  return { id, email: inv.email };
}

export async function invitationsEnCours() {
  return db()
    .select({ id: invitation.id, email: invitation.email, nom: invitation.nom, role: invitation.role, expireLe: invitation.expireLe })
    .from(invitation)
    .where(and(isNull(invitation.accepteeLe), gt(invitation.expireLe, new Date())))
    .orderBy(desc(invitation.creeLe));
}

export async function annulerInvitation(id: string): Promise<void> {
  await db().delete(invitation).where(and(eq(invitation.id, id), isNull(invitation.accepteeLe)));
}
