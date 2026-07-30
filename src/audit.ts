// src/audit.ts
// PURPOSE: tamper-evident, append-only log of every tool call.
// ANALOGY: a chain of wax seals — each seal's imprint depends on the previous
// one. Remove or alter any link and the chain visibly breaks on verify.

import { createHash } from "node:crypto";
import { appendFile, readFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { withLock } from "./lock.js";

const AUDIT_PATH = process.env.DEVVAULT_AUDIT ?? join(homedir(), ".devvault", "audit.log");

export interface AuditEntry {
  timestamp: string;
  tool: string;
  secretName?: string;
  result: "ok" | "error" | "denied";
  prevHash: string;
  hash: string;
}

function chainHash(data: object, prevHash: string): string {
  return createHash("sha256").update(JSON.stringify(data) + prevHash).digest("hex");
}

async function lastHash(): Promise<string> {
  try {
    const lines = (await readFile(AUDIT_PATH, "utf8")).trim().split("\n").filter(Boolean);
    if (!lines.length) return "GENESIS";
    return (JSON.parse(lines[lines.length - 1]) as AuditEntry).hash;
  } catch {
    return "GENESIS";
  }
}

// Logs the NAME and OUTCOME of an access — never the secret value.
export async function audit(tool: string, result: AuditEntry["result"], secretName?: string): Promise<void> {
 return withLock(async () => {
  const prevHash = await lastHash();
  const base = { timestamp: new Date().toISOString(), tool, secretName, result, prevHash };
  const entry: AuditEntry = { ...base, hash: chainHash(base, prevHash) };
  await mkdir(dirname(AUDIT_PATH), { recursive: true });
  await appendFile(AUDIT_PATH, JSON.stringify(entry) + "\n", { mode: 0o600 });
 });
}

// Verify the whole chain is intact. Returns the index of the first broken link, or -1 if OK.
export async function verifyAudit(): Promise<number> {
  let lines: string[];
  try { lines = (await readFile(AUDIT_PATH, "utf8")).trim().split("\n").filter(Boolean); }
  catch { return -1; } // no log yet = nothing to tamper
  let prevHash = "GENESIS";
  for (let i = 0; i < lines.length; i++) {
    const e = JSON.parse(lines[i]) as AuditEntry;
    const { hash, ...base } = e;
    if (e.prevHash !== prevHash || chainHash(base, prevHash) !== hash) return i;
    prevHash = hash;
  }
  return -1;
}
