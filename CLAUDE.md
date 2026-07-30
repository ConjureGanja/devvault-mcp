# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DevVault MCP — a local-first secrets vault exposed as an MCP stdio server. The entire product is one invariant: **plaintext secret values never travel back to the AI model.** The AI can store/list/rotate/delete secrets and run commands with them injected into a child process's environment, but no tool response ever contains a secret value. Every code change must preserve this.

## Commands

```bash
npm install
npm test                          # vitest run — all tests
npx vitest run src/vault.test.ts  # single test file
npm run build                     # tsup bundles src/server.ts → dist/server.js (ESM, node22)
```

CI (`.github/workflows/ci.yml`) runs `npm test` and `npm audit --omit=dev` on every push — keep runtime deps minimal and clean.

## Architecture

Data flows down, plaintext never flows back up:

- `src/server.ts` — the MCP tool surface (the only file that talks to the model). Registers `listSecrets`, `storeSecret`, `rotateSecret`, `deleteSecret`, `runWithSecrets`. `getSecret` is registered **only** when `~/.devvault/config.json` has `allowPlaintextReads: true` (via `config.ts`, default-deny). Auto-starts on stdio only when run as the entrypoint, so tests can import `buildServer()`.
- `src/vault.ts` — encrypted vault file (`~/.devvault/vault.enc`, mode 0600). Write paths (`putSecret`, `softDelete`) are wrapped in `withLock`. `revealSecret` is the **only** decrypt path — it is called by `runWithSecrets` and the gated `getSecret`, and must never be wired to any tool that returns its result as text to the model.
- `src/crypto.ts` — AES-256-GCM, fresh IV per secret, scrypt key derivation. Decrypt throws on tamper (fail closed — errors, never partial/plaintext fallbacks, is the pattern everywhere).
- `src/keystore.ts` — master key: tries the OS keychain via the *optional* `cross-keychain` dep (lazy import, any failure silently falls back), else derives from `DEVVAULT_PASSPHRASE` + persisted salt. Caches the key; `__resetKeyCache()` is the test seam.
- `src/run-with-secrets.ts` — the headline feature: spawns the child with secrets in its env (`shell: false` + args array, deliberately — blocks shell injection), then redacts every secret value from captured stdout/stderr before returning.
- `src/audit.ts` — hash-chained append-only log of tool name + secret name + outcome. Never log values. `verifyAudit()` returns the index of the first broken link.
- `src/lock.ts` — in-process promise-chain lock serializing read-modify-write of the vault and audit files.

## Conventions and gotchas

- **Paths are module-level constants read from env at import time** (`DEVVAULT_PATH`, `DEVVAULT_AUDIT`, `DEVVAULT_CONFIG`, `DEVVAULT_PASSPHRASE`). Tests set these env vars *before* dynamically importing the modules (see any `*.test.ts`). New file-path config should follow the same pattern.
- ESM throughout: relative imports use `.js` extensions even in `.ts` source.
- Server tests invoke tool handlers by reaching into `server._registeredTools`; the key security test asserts no safe-tool response ever contains a stored plaintext value — extend it when adding tools.
- Secret names are validated with `/^[A-Z0-9_]+$/`; the strict schema is a security control (names become env var keys), not cosmetics.
- Vault/audit/salt files are written with mode `0o600`.
- `package.json` `files` ships only `dist/`, `README.md`, `LICENSE` — don't widen it; the publish tarball must never contain source or local vault files.
- Delete is soft (tombstone via `metadata.deletedAt`); listing and reveal both filter tombstones.

## Product context

`LAUNCH_BRIEF.md` is the launch/monetization plan (npm publish, security review before charging money, future paid team-sync relay that stores ciphertext only). The README's framing matters: the tool "removes the agent's ability to read the secret", it does not claim to be independently security-reviewed — keep claims honest when editing docs.
