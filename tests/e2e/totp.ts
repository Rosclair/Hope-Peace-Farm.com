// Code TOTP (RFC 6238 : HMAC-SHA-1, 6 chiffres, 30 s) calculé par les tests à partir
// de la clé affichée à l’activation du second facteur, comme le ferait une application.

import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(texte: string): Buffer {
  const bits = texte
    .replace(/[\s=]/g, "")
    .toUpperCase()
    .split("")
    .map((c) => {
      const i = ALPHABET.indexOf(c);
      if (i < 0) throw new Error(`caractère base32 invalide : ${c}`);
      return i.toString(2).padStart(5, "0");
    })
    .join("");
  const octets = bits.match(/.{8}/g) ?? [];
  return Buffer.from(octets.map((o) => parseInt(o, 2)));
}

export function codeTotp(cle: string, instant = Date.now(), decalage = 0): string {
  const compteur = Math.floor(instant / 30_000) + decalage;
  const tampon = Buffer.alloc(8);
  tampon.writeBigUInt64BE(BigInt(compteur));
  const h = createHmac("sha1", base32(cle)).update(tampon).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}
