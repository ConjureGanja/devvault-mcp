// src/config.ts — reads ~/.devvault/config.json. Controls the dangerous escape hatch.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_PATH = process.env.DEVVAULT_CONFIG ?? join(homedir(), ".devvault", "config.json");

export interface DevVaultConfig { allowPlaintextReads: boolean; }

export async function loadConfig(): Promise<DevVaultConfig> {
  try {
    const c = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
    return { allowPlaintextReads: c.allowPlaintextReads === true }; // default-deny
  } catch {
    return { allowPlaintextReads: false };
  }
}
