// src/crypto.ts
// PURPOSE: encrypt/decrypt individual secret values.
// ANALOGY: each secret gets its own locked drawer (its own IV), so cracking
// one tells an attacker nothing about the others.

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";   // GCM = encryption + built-in tamper detection
const IV_LENGTH = 12;          // 96-bit nonce: the recommended size for GCM

// Derive a 32-byte (256-bit) key from a passphrase + salt.
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32);
}

export interface EncryptedBlob {
  ciphertext: string;  // base64
  iv: string;          // base64 — unique per secret
  authTag: string;     // base64 — GCM's tamper-proof seal
}

export function encrypt(plaintext: string, key: Buffer): EncryptedBlob {
  const iv = randomBytes(IV_LENGTH);              // NEVER reuse an IV with the same key
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

// Decrypt one value. Throws if tampered with — that's intentional (fail closed).
export function decrypt(blob: EncryptedBlob, key: Buffer): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),   // throws here if the authTag check fails
  ]);
  return plaintext.toString("utf8");
}
