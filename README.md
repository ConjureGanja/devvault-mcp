# DevVault MCP

**Your AI can use your secrets. It can never read them.**

DevVault is a local-first secrets vault that any MCP-aware client (Claude Desktop, Claude Code, Cursor, VS Code) can talk to. The AI assistant can *store, list, rotate, and operate* your secrets — but the plaintext values never enter the model's context, so a prompt-injection attack has nothing to steal.

---

## The problem

AI agents now touch real infrastructure — they deploy, call APIs, run migrations. That means they need credentials. Today you have three bad options:

1. **Paste the key into chat** — it's now in a transcript, a log, maybe a training set.
2. **Leave it in `.env`** — plaintext on disk, one `git add .` away from a public repo.
3. **Use an existing MCP vault** — better, but they expose a `getSecret` tool that drops the plaintext into the model's context. The OWASP MCP Top 10 lists prompt injection as the #1 threat: a hidden instruction in a web page or README that the agent obeys. If the agent can *read* the secret, an injection can make it *leak* the secret.

DevVault removes the agent's ability to read the secret in the first place.

**Analogy:** a hotel safe where the bellhop (the AI) can carry the locked box to your room and use what's inside on your behalf — but can never open it. The combination stays with you.

---

## How it works

```
MCP Client (Claude, Cursor)
        │   sees: names, metadata, exit codes, REDACTED output
        │   never sees: plaintext secret values
        ▼
DevVault MCP Server  ──►  Crypto core (AES-256-GCM, one IV per secret)
        │                       │ master key
        ▼                       ▼
Child process  ◄── secrets    OS keychain  (or passphrase fallback)
(npm deploy,      injected as
 curl, etc.)      env vars
```

The one line that is the whole product: **plaintext flows from the crypto core into the child process's environment, and never travels back up to the AI.**

---

## The tools

| Tool | Can the AI see the value? | Notes |
|---|---|---|
| `storeSecret` | No (write-only) | Confirms by name; value never echoed. |
| `listSecrets` | No (metadata only) | Names, project, timestamps. |
| `rotateSecret` | No (write-only) | Replaces a value in place. |
| `deleteSecret` | No | Soft-delete (recoverable). |
| `runWithSecrets` | **No** — injected into child env | Returns exit code + **redacted** stdout/stderr. This is the headline feature. |
| `getSecret` | Yes — *escape hatch* | **Off by default.** Only registers if you set `allowPlaintextReads: true`. Audited. |

Every call is recorded in a hash-chained, tamper-evident audit log (names + outcomes — never values).

---

## Install

```bash
npx devvault-mcp
```

### Connect to Claude Desktop

Add to your Claude Desktop MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "devvault": {
      "command": "npx",
      "args": ["-y", "devvault-mcp"]
    }
  }
}
```

Restart Claude Desktop. The DevVault tools will appear. Try: *"Store my Stripe test key as STRIPE_KEY, then list my secrets."*

### Master key

On macOS / Windows / Linux with a desktop keychain, DevVault stores its master key there automatically. In headless environments (CI, containers) set a passphrase instead:

```bash
export DEVVAULT_PASSPHRASE="a-long-random-passphrase"
```

---

## Security model (the short version)

1. **The model is an untrusted operator.** Every tool assumes the AI's context may be hijacked at any moment.
2. **Plaintext has exactly one exit, and it isn't the model** — the environment of a child process you asked to run.
3. **Tools are risk-tiered.** Safe tools never return values. `getSecret` is off by default. `deleteSecret` is soft + recoverable.
4. **Every access is on the record** — hash-chained audit log; alter one entry and the chain visibly breaks.
5. **Fail closed.** Wrong key, tampered data, unknown secret, corrupt vault → error, never a partial or plaintext fallback.

> **Note on concurrency:** writes are serialized with an in-process lock so parallel calls can't clobber the vault file. DevVault does not impose ordering between two *independent* concurrent tool calls — an MCP client should await each tool's result before issuing the next (which is how the model behaves normally).

> **Crypto disclaimer:** the encryption uses only Node's built-in `crypto` (no hand-rolled primitives), but this code has **not yet had an independent security review**. Do not rely on it for high-value production secrets until that review is done (see the launch brief).

---

## Configuration

| Env var | Purpose | Default |
|---|---|---|
| `DEVVAULT_PATH` | Vault file location | `~/.devvault/vault.enc` |
| `DEVVAULT_PASSPHRASE` | Master key fallback when no OS keychain | (none — keychain used) |
| `DEVVAULT_AUDIT` | Audit log location | `~/.devvault/audit.log` |
| `DEVVAULT_CONFIG` | Config file location | `~/.devvault/config.json` |

To enable the `getSecret` escape hatch, create `~/.devvault/config.json`:

```json
{ "allowPlaintextReads": true }
```

---

## Development

```bash
npm install
npm test     # 19 tests incl. tamper, wrong-key, redaction, no-leak, concurrency
npm run build
```

## License

Apache-2.0. The free local vault is open source — that's the distribution engine, not lost revenue. Paid collaboration (encrypted team sync, audit export, policy) is the roadmap.
