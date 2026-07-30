import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate every test run to a throwaway dir + passphrase BEFORE importing modules.
const dir = mkdtempSync(join(tmpdir(), "devvault-"));
process.env.DEVVAULT_PATH = join(dir, "vault.enc");
process.env.DEVVAULT_AUDIT = join(dir, "audit.log");
process.env.DEVVAULT_CONFIG = join(dir, "config.json");
process.env.DEVVAULT_PASSPHRASE = "test-passphrase-123";
process.env.HOME = dir; // salt lands here

const { putSecret, listSecrets, softDelete, revealSecret } = await import("./vault.js");
const { runWithSecrets, redact } = await import("./run-with-secrets.js");
const { audit, verifyAudit } = await import("./audit.js");

describe("vault storage", () => {
  it("stores then lists metadata only — never the value", async () => {
    await putSecret("API_KEY", "sk_secret_value_xyz", "proj1");
    const list = await listSecrets();
    const serialized = JSON.stringify(list);
    expect(serialized).toContain("API_KEY");
    expect(serialized).toContain("proj1");
    expect(serialized).not.toContain("sk_secret_value_xyz"); // value must NOT appear
  });

  it("createdAt is preserved across rotation; rotatedAt changes", async () => {
    const r1 = await putSecret("ROT", "v1");
    expect(r1).toBe("created");
    const created = (await listSecrets()).find((s) => s.name === "ROT")!.createdAt;
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await putSecret("ROT", "v2");
    expect(r2).toBe("rotated");
    const after = (await listSecrets()).find((s) => s.name === "ROT")!;
    expect(after.createdAt).toBe(created);
    expect(after.rotatedAt).not.toBe(created);
  });

  it("soft-delete hides from list and revealSecret throws (fail closed)", async () => {
    await putSecret("GONE", "bye");
    expect(await softDelete("GONE")).toBe(true);
    expect((await listSecrets()).find((s) => s.name === "GONE")).toBeUndefined();
    await expect(revealSecret("GONE")).rejects.toThrow();
  });
});

describe("runWithSecrets — the moat", () => {
  it("injects secret into child env and uses it", async () => {
    await putSecret("GREETING", "HELLO_FROM_VAULT");
    const r = await runWithSecrets("node", ["-e", "process.stdout.write('len='+process.env.GREETING.length)"], ["GREETING"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("len=16"); // child SAW the value (used its length)
  });

  it("REDACTS the value if the child program prints it", async () => {
    await putSecret("LEAKY", "TOPSECRET_DONT_PRINT");
    const r = await runWithSecrets("node", ["-e", "console.log(process.env.LEAKY)"], ["LEAKY"]);
    expect(r.stdout).not.toContain("TOPSECRET_DONT_PRINT"); // never reaches the model
    expect(r.stdout).toContain("[REDACTED]");
  });

  it("fails closed on unknown secret", async () => {
    await expect(runWithSecrets("node", ["-e", ""], ["NOPE_DOESNT_EXIST"])).rejects.toThrow();
  });

  it("redact() leaves short noise alone but scrubs real values", () => {
    expect(redact("abc x", ["x"])).toBe("abc x");      // <=3 chars: ignored
    expect(redact("key=ABCDEFG", ["ABCDEFG"])).toBe("key=[REDACTED]");
  });
});

describe("audit log — tamper-evident", () => {
  it("appends and verifies an intact chain", async () => {
    await audit("storeSecret", "ok", "X");
    await audit("runWithSecrets", "ok", "X");
    expect(await verifyAudit()).toBe(-1); // -1 = intact
  });

  it("never records the secret value", async () => {
    const { readFileSync } = await import("node:fs");
    await putSecret("AUDIT_CHECK", "VALUE_SHOULD_NOT_BE_LOGGED");
    await audit("storeSecret", "ok", "AUDIT_CHECK");
    const log = readFileSync(process.env.DEVVAULT_AUDIT!, "utf8");
    expect(log).toContain("AUDIT_CHECK");
    expect(log).not.toContain("VALUE_SHOULD_NOT_BE_LOGGED");
  });
});

describe("concurrency safety", () => {
  it("parallel writes don't clobber each other (lock serializes them)", async () => {
    await Promise.all([
      putSecret("C1", "v1"),
      putSecret("C2", "v2"),
      putSecret("C3", "v3"),
      putSecret("C4", "v4"),
      putSecret("C5", "v5"),
    ]);
    const names = (await listSecrets()).map((s) => s.name);
    for (const n of ["C1", "C2", "C3", "C4", "C5"]) expect(names).toContain(n);
  });

  it("parallel audit appends keep the hash chain intact", async () => {
    await Promise.all([
      audit("t", "ok", "a"), audit("t", "ok", "b"),
      audit("t", "ok", "c"), audit("t", "ok", "d"),
    ]);
    expect(await verifyAudit()).toBe(-1);
  });
});
