// src/run-with-secrets.ts
// PURPOSE: run a command with secrets injected as env vars into the CHILD
// process. The model gets the exit code + REDACTED output — never the values.
// ANALOGY: the AI hands a sealed envelope to the courier (the child process).
// The courier uses what's inside; the AI never opens the envelope.

import { spawn } from "node:child_process";
import { revealSecret } from "./vault.js";

export interface RunResult { exitCode: number; stdout: string; stderr: string; }

// Replace any occurrence of a real secret value with a marker, so a program
// that prints its own credential can't leak it back up to the model.
export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s.length > 3) out = out.split(s).join("[REDACTED]");
  }
  return out;
}

export async function runWithSecrets(
  command: string,
  args: string[],
  secretNames: string[],
): Promise<RunResult> {
  const injectedEnv: Record<string, string> = {};
  const plaintextValues: string[] = [];
  for (const name of secretNames) {
    const value = await revealSecret(name); // throws (fail closed) if unknown
    injectedEnv[name] = value;
    plaintextValues.push(value);
  }

  return new Promise<RunResult>((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...injectedEnv },
      shell: false, // shell:false + args array blocks shell-injection
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => resolve({ exitCode: -1, stdout: "", stderr: redact(String(e), plaintextValues) }));
    child.on("close", (code) => resolve({
      exitCode: code ?? -1,
      stdout: redact(stdout, plaintextValues),
      stderr: redact(stderr, plaintextValues),
    }));
  });
}
