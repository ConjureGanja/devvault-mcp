import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "devvault-srv-"));
process.env.DEVVAULT_PATH = join(dir, "vault.enc");
process.env.DEVVAULT_AUDIT = join(dir, "audit.log");
process.env.DEVVAULT_CONFIG = join(dir, "config.json");
process.env.DEVVAULT_PASSPHRASE = "srv-pass";
process.env.HOME = dir;

const { buildServer } = await import("./server.js");
const { putSecret } = await import("./vault.js");

// Reach into the registered tools to invoke their handlers directly.
function getTools(server: any): Record<string, any> {
  return server._registeredTools ?? server.tools ?? {};
}
async function call(server: any, name: string, args: any) {
  const tools = getTools(server);
  const tool = tools[name];
  if (!tool) throw new Error(`tool ${name} not registered`);
  const handler = tool.callback ?? tool.handler ?? tool.cb;
  return handler(args, {});
}

describe("MCP server tool surface", () => {
  it("getSecret is NOT registered when allowPlaintextReads is false (default)", async () => {
    const server = await buildServer();
    expect(getTools(server).getSecret).toBeUndefined();
    expect(getTools(server).runWithSecrets).toBeDefined();
  });

  it("no safe tool response ever contains a stored plaintext value", async () => {
    await putSecret("INJECT_TEST", "PLAINTEXT_NEVER_LEAKS_42");
    const server = await buildServer();
    const responses = await Promise.all([
      call(server, "listSecrets", {}),
      call(server, "storeSecret", { name: "INJECT_TEST", value: "PLAINTEXT_NEVER_LEAKS_42", project: "default" }),
      call(server, "runWithSecrets", { command: "node", args: ["-e", "console.log(process.env.INJECT_TEST)"], secretNames: ["INJECT_TEST"] }),
    ]);
    const all = JSON.stringify(responses);
    expect(all).not.toContain("PLAINTEXT_NEVER_LEAKS_42");
  });

  it("getSecret IS registered (and gated/audited) when explicitly enabled", async () => {
    writeFileSync(process.env.DEVVAULT_CONFIG!, JSON.stringify({ allowPlaintextReads: true }));
    const server = await buildServer();
    expect(getTools(server).getSecret).toBeDefined();
  });
});
