// src/keystore.ts
// PURPOSE: get the 32-byte master key. Prefer the OS keychain; fall back to a
// passphrase-derived key so the vault still works where no keychain exists
// (CI, containers, headless Linux). ANALOGY: the master key normally lives in
// the bank vault (OS keychain); if that bank is closed, you can still open the
// safe with a memorized combination (passphrase) — slower, but never locked out.

import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { deriveKey } from "./crypto.js";

const KEYCHAIN_SERVICE = "devvault-mcp";
const KEYCHAIN_ACCOUNT = "master-key";
const SALT_PATH = join(homedir(), ".devvault", "key.salt");

// Lazy, optional dependency. If cross-keychain isn't installed/available we
// silently use the passphrase path. This keeps runtime deps minimal and the
// install bulletproof. ANALOGY: try the bank; if it's not there, don't crash.
async function tryOsKeychain(): Promise<Buffer | null> {
  try {
    const kc: any = await import("cross-keychain").catch(() => null);
    if (!kc) return null;
    const getPassword = kc.getPassword ?? kc.default?.getPassword;
    const setPassword = kc.setPassword ?? kc.default?.setPassword;
    if (!getPassword || !setPassword) return null;

    let b64: string | null = await getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    if (!b64) {
      b64 = randomBytes(32).toString("base64");
      await setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, b64);
    }
    return Buffer.from(b64, "base64");
  } catch {
    return null; // any keychain failure → fall back, never throw
  }
}

// Passphrase fallback: derive the key from DEVVAULT_PASSPHRASE + a persisted salt.
async function passphraseKey(): Promise<Buffer> {
  const pass = process.env.DEVVAULT_PASSPHRASE;
  if (!pass) {
    throw new Error(
      "No OS keychain available and DEVVAULT_PASSPHRASE is not set. " +
      "Set a passphrase env var so DevVault can derive its master key."
    );
  }
  let salt: Buffer;
  try {
    salt = Buffer.from(await readFile(SALT_PATH, "utf8"), "base64");
  } catch {
    salt = randomBytes(16);
    await mkdir(dirname(SALT_PATH), { recursive: true });
    await writeFile(SALT_PATH, salt.toString("base64"), { mode: 0o600 });
  }
  return deriveKey(pass, salt);
}

let cached: Buffer | null = null;
export async function getMasterKey(): Promise<Buffer> {
  if (cached) return cached;
  cached = (await tryOsKeychain()) ?? (await passphraseKey());
  return cached;
}

// test seam
export function __resetKeyCache() { cached = null; }
