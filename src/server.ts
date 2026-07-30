#!/usr/bin/env node
// src/server.ts
// PURPOSE: expose vault operations as MCP tools. The receptionist that follows
// a strict script about what it will and won't say back to the AI.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { putSecret, listSecrets, softDelete, revealSecret } from "./vault.js";
import { runWithSecrets } from "./run-with-secrets.js";
import { audit } from "./audit.js";
import { loadConfig } from "./config.js";

const NAME_RE = /^[A-Z0-9_]+$/; // strict schema = a security control

function text(s: string) { return { content: [{ type: "text" as const, text: s }] }; }

export async function buildServer() {
  const server = new McpServer({ name: "devvault-mcp", version: "0.1.0" });

  // listSecrets — labels only, never values
  server.registerTool("listSecrets", {
    title: "List secrets",
    description: "List secret names and metadata. Does NOT return secret values.",
    inputSchema: { project: z.string().optional() },
  }, async ({ project }) => {
    const names = await listSecrets(project);
    await audit("listSecrets", "ok");
    return text(JSON.stringify(names, null, 2));
  });

  // storeSecret — write-only; value goes in, is not echoed
  server.registerTool("storeSecret", {
    title: "Store a secret",
    description: "Encrypt and store a secret value. The value is never returned.",
    inputSchema: {
      name: z.string().regex(NAME_RE),
      value: z.string().min(1),
      project: z.string().default("default"),
    },
  }, async ({ name, value, project }) => {
    const r = await putSecret(name, value, project);
    await audit("storeSecret", "ok", name);
    return text(`${r === "rotated" ? "Rotated" : "Stored"} "${name}" in project "${project}".`);
  });

  // rotateSecret — alias of store for an existing name (write-only)
  server.registerTool("rotateSecret", {
    title: "Rotate a secret",
    description: "Replace a secret's value. The value is never returned.",
    inputSchema: { name: z.string().regex(NAME_RE), value: z.string().min(1), project: z.string().default("default") },
  }, async ({ name, value, project }) => {
    await putSecret(name, value, project);
    await audit("rotateSecret", "ok", name);
    return text(`Rotated "${name}".`);
  });

  // deleteSecret — soft delete (destructive tier; recoverable window)
  server.registerTool("deleteSecret", {
    title: "Delete a secret",
    description: "Soft-delete a secret (recoverable). The value is never returned.",
    inputSchema: { name: z.string().regex(NAME_RE) },
  }, async ({ name }) => {
    const ok = await softDelete(name);
    await audit("deleteSecret", ok ? "ok" : "error", name);
    return text(ok ? `Deleted "${name}".` : `No active secret named "${name}".`);
  });

  // runWithSecrets — THE MOAT. Injects into child env; returns redacted output only.
  server.registerTool("runWithSecrets", {
    title: "Run a command with secrets",
    description: "Run a command with named secrets injected as environment variables into the child process. Returns exit code and REDACTED output. Secret values are never exposed to the model.",
    inputSchema: {
      command: z.string().min(1),
      args: z.array(z.string()).default([]),
      secretNames: z.array(z.string().regex(NAME_RE)).min(1),
    },
  }, async ({ command, args, secretNames }) => {
    try {
      const r = await runWithSecrets(command, args, secretNames);
      await audit("runWithSecrets", "ok", secretNames.join(","));
      return text(JSON.stringify({ exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr }, null, 2));
    } catch (e) {
      await audit("runWithSecrets", "error", secretNames.join(","));
      return text(`Error: ${(e as Error).message}`);
    }
  });

  // getSecret — DANGEROUS escape hatch. Registered ONLY if explicitly enabled.
  const cfg = await loadConfig();
  if (cfg.allowPlaintextReads) {
    server.registerTool("getSecret", {
      title: "Read a secret value (escape hatch)",
      description: "Returns a plaintext secret value. Disabled by default; audited. Avoid — prefer runWithSecrets.",
      inputSchema: { name: z.string().regex(NAME_RE) },
    }, async ({ name }) => {
      const value = await revealSecret(name);
      await audit("getSecret", "ok", name);
      return text(value);
    });
  }

  return server;
}

// Only auto-start when run as the entrypoint (not when imported by tests).
// pathToFileURL handles Windows paths; realpathSync handles the npm bin symlink.
const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (isMain) {
  const server = await buildServer();
  await server.connect(new StdioServerTransport());
}
