// src/vault.ts
// PURPOSE: load/save the encrypted vault file. crypto.ts is the lock on each
// drawer; this is the filing cabinet + the rule about where it lives on disk.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { encrypt, decrypt, type EncryptedBlob } from "./crypto.js";
import { getMasterKey } from "./keystore.js";
import { withLock } from "./lock.js";

// Allow override for tests / multi-profile use.
const VAULT_PATH = process.env.DEVVAULT_PATH ?? join(homedir(), ".devvault", "vault.enc");

export interface SecretMetadata {
  project: string;
  createdAt: string;
  rotatedAt: string;
  deletedAt?: string; // soft-delete tombstone
}
export interface SecretRecord { blob: EncryptedBlob; metadata: SecretMetadata; }
export interface VaultFile { version: 1; secrets: Record<string, SecretRecord>; }

export async function loadVault(): Promise<VaultFile> {
  try {
    return JSON.parse(await readFile(VAULT_PATH, "utf8"));
  } catch {
    return { version: 1, secrets: {} }; // first run: empty vault
  }
}

export async function saveVault(v: VaultFile): Promise<void> {
  await mkdir(dirname(VAULT_PATH), { recursive: true });
  // mode 0o600 = owner read/write ONLY. Other OS users can't even open the file.
  await writeFile(VAULT_PATH, JSON.stringify(v, null, 2), { mode: 0o600 });
}

// --- write paths: value goes IN, never comes back out --------------------------
export async function putSecret(name: string, value: string, project = "default"): Promise<"created" | "rotated"> {
 return withLock(async () => {
  const vault = await loadVault();
  const key = await getMasterKey();
  const now = new Date().toISOString();
  const existing = vault.secrets[name];
  const isRotate = !!existing && !existing.metadata.deletedAt;
  vault.secrets[name] = {
    blob: encrypt(value, key),
    metadata: {
      project,
      createdAt: existing?.metadata.createdAt ?? now,
      rotatedAt: now,
    },
  };
  await saveVault(vault);
  return isRotate ? "rotated" : "created";
 });
}

export async function listSecrets(project?: string) {
  const vault = await loadVault();
  return Object.entries(vault.secrets)
    .filter(([, r]) => !r.metadata.deletedAt)
    .filter(([, r]) => !project || r.metadata.project === project)
    .map(([name, r]) => ({ name, ...r.metadata })); // metadata only — NEVER blob/value
}

export async function softDelete(name: string): Promise<boolean> {
 return withLock(async () => {
  const vault = await loadVault();
  const rec = vault.secrets[name];
  if (!rec || rec.metadata.deletedAt) return false;
  rec.metadata.deletedAt = new Date().toISOString();
  await saveVault(vault);
  return true;
 });
}

// Internal-only decrypt for runWithSecrets / gated getSecret. NOT exported to any
// tool that returns text to the model.
export async function revealSecret(name: string): Promise<string> {
  const vault = await loadVault();
  const rec = vault.secrets[name];
  if (!rec || rec.metadata.deletedAt) throw new Error(`Unknown secret: ${name}`);
  const key = await getMasterKey();
  return decrypt(rec.blob, key);
}
