# 01 — Simplify Onboarding (the install script)

_Answers reviewer points #1 ("too complex, clients set everything up") and #2 ("make a script that auto-configures the widget")._

## Where we are today (the honest baseline)

Install is **developer-only**. To go live a customer must:

1. `npm install @neylonai/sdk` in their app.
2. Import and call `mountSupportWidget({ config: { apiKey, pagePath } })` **or** render `<SupportWidget config={{ apiKey, customization }} />` in their app shell (`packages/sdk/src/embed.ts`, `packages/sdk/src/react/...`).
3. Put the API key in an env var and wire it in.
4. **Rebuild and redeploy** the site.

There is **no `<script>` tag**, **no hosted loader**, **no CMS plugin**. The embed bundle exists — `packages/sdk/build-embed.mjs` builds a self-contained ESM file with esbuild — but **nothing serves it publicly**, and it still expects a developer to import it.

**Consequence:** a Webflow / Framer / WordPress / Squarespace / plain-HTML site — i.e. most SaaS marketing sites — **cannot install Neylon at all** without a dev exporting code. That is the literal root of "too complex for clients."

| Step | Today | Requires a developer? |
|---|---|---|
| Get API key | Dashboard → Settings → API keys ✅ | No |
| Add widget to site | `npm install` + code + import | **Yes** |
| Configure appearance | Dashboard (4 sections) ✅ | No |
| Seed knowledge | Add Website integration + crawl | No, but manual |
| Go live | **Rebuild + redeploy** | **Yes** |

Two of five steps hard-require an engineer. Kill those two and onboarding becomes self-serve.

## The target: "copy one line → live in 5 minutes"

The gold standard (Intercom, Chatbase, Crisp, Drift all do this): the user copies **one snippet**, pastes it once into their site's `<head>` or footer, and the widget appears — styled from their dashboard, knowledge already seeded. No build, no redeploy, no npm.

```html
<!-- Target end-state: the only thing a customer ever pastes -->
<script src="https://cdn.neylon.ai/widget.js" data-key="nk_live_xxx" async></script>
```

Everything else (branding, tabs, proactive triggers, page targeting) is read at runtime from `GET /api/v1/widget-config/public` — which **already exists**. The snippet never changes when they restyle; they just edit the dashboard.

## Option A — Script-tag / CDN embed  ⭐ recommended, highest leverage

**What:** Host the already-built embed bundle at a stable URL and add a tiny auto-init loader that reads `data-key` (and optional `data-*` overrides), then mounts into a Shadow DOM (the mount code already isolates styles).

**Why it wins:**
- **One artifact unlocks every no-code platform at once** — Webflow, Framer, WordPress, Squarespace, Wix, Shopify, plain HTML. You don't build six integrations; you build one `<script>` and write six paste-guides.
- Reuses what you have: `build-embed.mjs` output + the public config endpoint + Shadow-DOM mount. This is **plumbing, not new architecture.**
- Zero redeploys for the customer ever again — restyling is dashboard-only.

**Work required:**
1. Add an **auto-init entry** to the embed build: on load, find the script tag, read `data-key`, call the existing mount with `{ apiKey }`.
2. **Serve it** from a CDN-backed, versioned URL (e.g. `/widget.js` → latest, `/v1/widget.js` pinned). Cache-bust on release.
3. **CORS**: confirm the public config + chat endpoints accept cross-origin from arbitrary customer domains (they must, for a cross-site widget). Lock write endpoints to the API key.
4. **Domain allowlist (optional, recommended):** let a customer bind an API key to their domain(s) so a leaked public key can't be reused elsewhere. (Public keys are inherently exposed in a script tag — this is the standard mitigation.)
5. Generate the **snippet in the dashboard** with the key pre-filled and a copy button. (Today the developer section shows npm usage; add a "No-code / script tag" tab next to it.)

**Trade-offs / watch-outs:**
- Public key is visible in page source — expected for all widgets; mitigate with domain allowlist + the key being chat-only (no admin scope). Confirm current API key scoping.
- You own uptime/caching of the CDN artifact.

## Option B — `npx neylon init` CLI (for the dev/framework crowd)

**What:** A CLI that a developer runs inside a React/Next project: prompts for (or reads) the API key, injects `<SupportWidget />` or `mountSupportWidget()` into the right place, writes the env var.

```bash
npx neylon init          # detects framework, wires the SDK, sets the key
```

**When it matters:** teams who *want* the widget inside their app bundle (SPA route control, auth'd user context, CSP strictness). This is the literal "run a script on the project and it auto-configures" the reviewer described — but it only serves **developers**, which is the smaller half of the market.

**Trade-off:** solves the reviewer's words but not the reviewer's *intent*. Webflow users can't run npx against a hosted site. So B is a **complement**, not the answer.

## Option C — Native platform apps (Webflow App, WP plugin)

Covered in [`02-distribution-funnel.md`](./02-distribution-funnel.md) as a **distribution** play. Technically a native Webflow App can inject the same script for the user (no copy-paste at all) and gets you marketplace placement. Higher effort; do it **after** Option A proves the script works, because the app just automates pasting the Option-A snippet.

## Recommendation

**Ship Option A now. Add Option B for developers. Do Option C (Webflow App) as the distribution wedge once A is stable.**

Rationale: A is mostly wiring over code you already have, and it removes *both* dev-required steps for *every* platform simultaneously — the single highest-leverage change against the "too complex" feedback.

## Second onboarding gap: the empty bot

Even with one-line install, if the bot answers "I don't know" on day one, the customer churns. Today knowledge seeding is manual (add Website integration → crawl).

**Fix: auto-crawl on signup.** When a customer verifies their site/domain, kick off a background crawl of their public pages into the existing pgvector RAG so the bot is useful the moment the widget loads. You already have the Website integration + crawler + embeddings pipeline — this is sequencing them into the signup flow, plus a "knowledge is ready" indicator in onboarding.

## Today → target scorecard

| Dimension | Today | Target |
|---|---|---|
| Install | npm + code + redeploy | Paste one `<script>` line |
| Platforms supported | React/Next apps only | Any website (Webflow, WP, Framer, HTML…) |
| Time to live | Dev task, hours–days | ~5 min, self-serve |
| Restyle | May need redeploy | Dashboard only, instant |
| First-load usefulness | Empty until manual crawl | Auto-crawled on signup |
| Who can do it | Developer | Marketer / founder / anyone |

## Decisions for you

1. **Approve Option A (script-tag/CDN) as the primary install?** (My recommendation: yes.)
2. **Where do we host `widget.js`?** (Your existing infra + a CDN in front, or a dedicated static host.) Do you want a **versioned** URL (`/v1/widget.js`) from day one? (Recommended: yes, so you can ship breaking changes safely.)
3. **Domain allowlist per API key** — build it now (before public keys are in the wild) or fast-follow?
4. **Auto-crawl on signup** — in scope for the onboarding revamp, or a separate milestone?
5. **Do we also ship `npx neylon init` (Option B)** for developers, or defer until asked?
6. **Keep the npm/`<SupportWidget/>` path** as the "advanced/dev" option alongside the script tag? (Recommended: yes — it's your power-user/customization story, see [`04`](./04-customization.md).)
