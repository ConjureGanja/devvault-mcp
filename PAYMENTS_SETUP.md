# Getting paid for DevVault MCP — click-by-click

*Written 25 Aug 2026. Every fact below was verified against your live Stripe account and the npm registry on that date.*

---

## Read this first: there is nothing broken to fix on npm

You asked to get the Stripe payment plan working on npmjs for this package. That specific thing does not exist, and it is worth being blunt about it so you do not spend another evening looking for the setting.

**npm has no way for a package author to charge the people who install their package.** There is no marketplace, no paid-package feature, no Stripe connection, no revenue share. It has never existed. The only money npm handles is *you paying npm* — a paid npm account (private packages, org seats) billed to your card. Stripe is npm's own payment processor for that, which is almost certainly where the wires crossed: you saw Stripe in npm's billing flow and reasonably assumed the two connect. They don't. That billing page is npm charging you, not your customers paying you.

So there is no npm setting to repair. What's actually true right now:

| Thing | State as of 25 Aug 2026 |
|---|---|
| `devvault-mcp` on npm | **Not published.** Registry returns 404 — the name is free and waiting for you. |
| `devvault` on npm | Name is taken (registered 18 Aug 2026) but has **zero published versions**. If that was you, it's a reserved shell. |
| `mcp-safeguard` on npm | **Published** — v0.1.0, 3 Aug 2026, maintainer `wizardconjure`. See the name note below. |
| Stripe live "Pro Plan" | Exists — **$19.00/month**, recurring, product `prod_V3GpNRPxVW88PV` |
| Stripe live "Enterprise Plan" | Exists — **$36.99/month**, recurring, product `prod_V3GqaucTXwh7WE` |
| Stripe payment links | **None.** Zero. |
| Stripe live customers | **0** |
| Stripe live subscriptions | **0** |

Nothing is failing. Nothing was ever connected. You built two price tags and no cash register, and pointed both at a shop that hasn't opened.

**The real gap is this:** a Stripe product with no payment link is a private note to yourself. There is no URL a human being can click to give you $19. That is the actual fix, and it takes about ten minutes.

---

## About the name `mcp-safeguard`

That name is live on npm and it is yours (maintainer `wizardconjure`, your email) — but **it is a different product from this repo**, so it is not a name DevVault can simply move into.

| | `mcp-safeguard` v0.1.0 (published) | this repo |
|---|---|---|
| What it is | CLI that **scans** MCP tool definitions for risks | MCP **server** that holds secrets |
| Ships | `dist/cli.js`, bin `mcp-safeguard` | `dist/server.js`, bin `devvault-mcp` |
| Invoked as | `npx mcp-safeguard ./tools.json` | an MCP server in a client config |
| Dependencies | zero | MCP SDK + zod |
| License | LGPL-2.1-only | Apache-2.0 |
| Source | `ConjureGanja/mcp-security-tools`, `packages/mcpscan` | `ConjureGanja/devvault-mcp` |

Both are MCP security tools, which is exactly why they're easy to conflate. But publishing this repo's code under `mcp-safeguard` would replace a working scanner with an unrelated secrets vault at the same install name — anyone whose CI runs `npx --yes mcp-safeguard ./tools.json` would get a server that waits on stdin and hangs their pipeline. **Don't publish over it.**

That leaves a genuine decision about which product the $19/$36.99 plans belong to, and it's yours to make — see "Which product are you selling?" at the end of this document. The Stripe setup in Part 1 is identical either way, so do that first; it is not blocked on the answer.

---

## What "working" actually means here

Three layers, in this order. Skipping straight to layer 3 is the mistake almost everyone makes.

1. **A cash register** — a public URL where someone can subscribe. Stripe Payment Links. No code. Today.
2. **An audience** — the free package on npm, with those links in the README. Without this, layer 1 is a shop in a desert.
3. **A turnstile** — code that checks whether a payer is a payer (license key → the encrypted team-sync relay from your launch brief). This is real engineering and it comes *after* you have people asking for it.

This document covers layers 1 and 2 completely. Layer 3 is deliberately not built yet, for the reason your own `LAUNCH_BRIEF.md` gives: every paid feature built before you have users is a guess.

---

# PART 1 — Stripe: build the cash register

**Automated version:** double-click `scripts\win\01-open-stripe-setup.bat`. It walks you through these five pages one at a time and opens each one for you. The manual steps are below in case you'd rather drive yourself.

### 1.1 Confirm your account can take live money

🔗 **https://dashboard.stripe.com/settings/payouts**

- If a banner asks you to activate payments or complete your business profile, click it and finish it.
- You'll need: legal name and address, a tax ID (SSN is fine for a US sole proprietor), and a bank account for payouts.
- No banner, page looks normal → you're already activated, move on.

> ❌ **Common mistake:** creating products and links first, then discovering at the first sale that the account was never activated and the money is sitting in limbo. ✅ Check activation before anything else.

### 1.2 Set your public business details

🔗 **https://dashboard.stripe.com/settings/public**

| Field | Set it to |
|---|---|
| Public business name | `DevVault` |
| Statement descriptor | `DEVVAULT` |
| Support email | a real inbox you actually read |
| Business URL | your GitHub repo is fine for now |

> ❌ **Common mistake:** leaving the statement descriptor at the Stripe default. Two months later a customer sees an unrecognizable line on their card statement and files a chargeback instead of emailing you. Each chargeback costs you the sale *plus* a $15 fee.

### 1.3 Create the Pro payment link — $19/month

🔗 **https://dashboard.stripe.com/payment-links/create**

1. In the product dropdown, select the **existing "Pro Plan"**. Do not create a second product — you'd end up with two "Pro Plan" entries and no idea which one your customers are on.
2. Confirm it reads **USD 19.00 / month, recurring**.
3. Open **Options** → **After payment** → *Show confirmation page*, and write a message that says what happens next. Something honest, like: *"Thanks. Your license key arrives by email within one business day."* Whatever you promise here, you have to actually do.
4. Click **Create link**, then **copy the link**. It looks like `https://buy.stripe.com/xxxxxxxxxxxx`.
5. Paste it somewhere you won't lose it.

### 1.4 Create the Enterprise payment link — $36.99/month

Same page, same steps, select the existing **"Enterprise Plan"**. Copy that link too.

> 💡 One thing to think about while you're here: $36.99/month is an oddly precise number for an "Enterprise" tier. Enterprise buyers don't price-shop at $37 — they have procurement, they want an invoice and an SSO checkbox, and the price is usually "contact us". A cleaner shape for a solo product is Pro at $19 and an Enterprise tier that's a *contact link*, not a payment link. Your call entirely; the setup below works either way.

### 1.5 Turn on the customer portal

🔗 **https://dashboard.stripe.com/settings/billing/portal**

1. Activate the customer portal link.
2. Under **Subscriptions**, tick **"Customers can cancel subscriptions"**.
3. Under **Business information**, add your terms-of-service and privacy-policy URLs. Stripe will not save without them.
4. Save.

> ❌ **Common mistake:** shipping a subscription with no self-serve cancel. Every cancellation then becomes an email to you, and the ones who don't get a reply within a day dispute the charge with their bank instead.

### 1.6 Check your work

Run `scripts\win\05-verify-payment-links.bat`, paste both links in, and it confirms each one is reachable and live. Then open them in an incognito window and check the price, product name, and that *your* business name shows.

**Do not test a live link with a real card.** If you want a genuine end-to-end test, recreate the link in test mode at 🔗 **https://dashboard.stripe.com/test/payment-links** and pay with `4242 4242 4242 4242`, any future expiry, any CVC.

---

# PART 2 — npm: publish the free package

This is the layer that makes layer 1 worth anything.

The scripts below read the package name straight out of `package.json`, so they work whatever you decide to call it — and they stop you if that name is already published to something else.

### 2.1 npm account with 2FA — non-negotiable

🔗 **https://www.npmjs.com/signup** (if you don't have an account)
🔗 **https://www.npmjs.com/settings/~/profile** → Two-Factor Authentication → enable, choose **"Authorization and Publishing"**

> ❌ **Common mistake:** "I'll add 2FA later." ✅ Do it before the first publish. A hijacked npm account on a *secrets vault* package means an attacker ships malware to every single person who installs your security tool. That is the worst headline available to you, and it's a five-minute prevention.

### 2.2 Preflight

```
scripts\win\02-npm-preflight.bat
```

Checks Node ≥ 22, confirms the name is still free, installs, runs all 19 tests, builds `dist/`, and prints the exact tarball contents. It publishes nothing and is safe to run repeatedly.

**When it prints the file list, actually read it.** It must contain only `dist/`, `README.md`, `LICENSE`, `package.json`. If you see a `.ts` file, a `.env`, or a `.enc` vault — stop. For a secrets product, shipping your own vault file in the tarball would be both the punchline and a real breach. Your `package.json` `files` whitelist already prevents this; the check is there because the cost of being wrong once is unrecoverable.

### 2.3 Publish

```
scripts\win\03-npm-publish.bat
```

Handles login, shows the tarball one more time, makes you type `PUBLISH` in caps, then runs `npm publish --access public`.

**This is irreversible.** A published version number can never be reused, and unpublishing is only permitted within 72 hours.

If it fails, the script prints the fix. The two you're most likely to hit:

- **403, name too similar to an existing package** — npm's typosquat filter may reject `devvault-mcp` because `devvault` already exists. This is a genuine possibility given that name is registered. Fix: change `"name"` in `package.json` to a scoped name, `@wizardconjure/devvault-mcp`, and rerun. Scoped names bypass the filter entirely and cost nothing when public.
- **The preflight refuses to continue because the name is already published** — that guard exists specifically to stop you from overwriting `mcp-safeguard`. Pick a free name rather than forcing past it.
- **OTP required / invalid** — your 2FA code expired. Rerun with a fresh one.

### 2.4 Verify like a stranger

```
scripts\win\04-verify-install.bat
```

Installs the *published* package into a clean temp folder and launches it. This catches the classic failure where everything works locally only because `dist/` happens to be sitting in your project folder.

Then point Claude Desktop at the published package rather than your local path:

```json
{
  "mcpServers": {
    "devvault": {
      "command": "npx",
      "args": ["-y", "<your published package name>"]
    }
  }
}
```

Fully **quit** Claude Desktop and reopen — closing the window leaves the old server running.

---

# PART 3 — Connect the two

Once both links exist and the package is live, add a short pricing section to `README.md` pointing at the Stripe links. That is the entire connection between npm and Stripe: a hyperlink. There is no integration to configure, and anyone offering you one is selling something.

What you are selling at that point is a **promise** — pay $19, get team sync when it ships. That is a legitimate way to test demand (call it early access, be explicit that it's pre-release), but be honest in the README about what exists today versus what's coming. Your README's current tone is carefully honest about the security claims; keep that same tone about the paid tier.

**Layer 3, when you're ready:** the encrypted sync relay, license keys, and a signature-verified Stripe webhook that flips a customer to Pro. Say *"let's build the sync relay"* and that's a real session's work — but it should follow real users asking for it, not precede them.

---

## Before you take the first real dollar

Two things from your own launch brief that money makes non-optional. Neither blocks the setup above — publish free, build the links, get users. But before you accept a live payment:

1. **An independent security review of the crypto and the MCP tool surface.** Your README currently says, honestly, that this code has not had one. Free OSS users accept that. Paying customers of a *secrets vault* do not, and the sentence "independently security-reviewed" is also the best marketing this product can buy. Hire an application-security engineer with actual crypto experience, not a generalist dev.
2. **Terms of service and a liability disclaimer.** A secrets product carries real liability, and Stripe's customer portal requires the URLs anyway (step 1.5). A few hundred dollars with a lawyer is cheap against the downside.

---

## Script reference

All scripts live in `scripts\win\`. Double-click, or run from a terminal. They're plain batch files — open any of them in Notepad and read exactly what they do before running.

| Script | What it does | Reversible? |
|---|---|---|
| `01-open-stripe-setup.bat` | Guided tour of the 5 Stripe pages; opens each one for you | Yes — only opens URLs |
| `02-npm-preflight.bat` | Node/name/install/test/build/tarball checks | Yes — publishes nothing |
| `03-npm-publish.bat` | Login, confirm, `npm publish --access public` | **No** |
| `04-verify-install.bat` | Clean-room install of the published package | Yes |
| `05-verify-payment-links.bat` | Confirms your payment links are live | Yes — never touches your Stripe key |

None of these scripts ask for, store, or transmit a Stripe secret key. For a tool whose entire premise is that secrets don't travel, it would be poor form to start the billing setup by pasting a live API key into a batch file.

---

## Open decision: which product are you selling?

The Stripe plans exist; what they *entitle* you to is still undecided, and the `mcp-safeguard` name makes that concrete. Three coherent answers:

**1. The plans belong to the scanner (`mcp-safeguard`), not the vault.** A CI-gating security scanner is honestly the easier sell of the two — it already produces a pass/fail a team cares about, and the paid tier writes itself: more rules, a hosted dashboard, org-wide reporting. If this is it, the pricing links go in the `mcp-security-tools` README and DevVault stays free for now.

**2. The plans belong to DevVault, which keeps a name of its own.** Publish as `devvault-mcp` (or scoped), and the paid tier is the encrypted team-sync relay from the launch brief. This is the plan already written down — it just needs users first.

**3. "MCP Safeguard" becomes the umbrella brand for both.** The scanner keeps `mcp-safeguard`; the vault ships alongside as a scoped sibling such as `@wizardconjure/safeguard-vault`, and one subscription covers the suite. Most work, best story, and the only option where the shared name is an asset rather than a collision.

Whichever you pick, Part 1 is unchanged — the cash register is the same register.
