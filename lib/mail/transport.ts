// Transport SMTP (Nodemailer) de la boîte du domaine. Créé à la première
// utilisation : sans configuration SMTP, le reste du site fonctionne.

import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { configSmtp } from "@/lib/config";

const global_ = globalThis as typeof globalThis & { __hpfSmtp?: Transporter };

export function transport(): Transporter {
  if (!global_.__hpfSmtp) {
    const c = configSmtp();
    const local = c.hote === "localhost" || c.hote === "127.0.0.1";
    global_.__hpfSmtp = nodemailer.createTransport({
      host: c.hote,
      port: c.port,
      secure: c.securise,
      // Hors TLS direct, STARTTLS est exigé, sauf vers un serveur de test local (Mailpit).
      requireTLS: !c.securise && !local,
      auth: { user: c.utilisateur, pass: c.motDePasse },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }
  return global_.__hpfSmtp;
}

export function expediteur(): string {
  return configSmtp().expediteur;
}

