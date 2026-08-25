# Neylon AI — Strategy Evaluation Pack

_Last updated: 2026-08-25. Author: working notes for founder review. Nothing here is committed to code; these are decision docs._

## Why this pack exists

You received review feedback that boils down to four things:

1. **"Too complex for clients"** — clients have to set everything up themselves.
2. **Build an install script** that auto-configures the support widget when run on a project.
3. **Build Webflow plugins/app** — most US B2B & B2C SaaS marketing sites run on Webflow.
4. **Target the US market**, not India.

This pack turns that feedback into an evaluable plan across four axes — **simplify, distribute, price, customize** — so you can decide what to build, in what order, and how to charge. Each doc ends with a **Decisions for you** section. Read this overview first, then the four deep-dives.

| Doc | Question it answers |
|---|---|
| [`01-simplify-onboarding.md`](./01-simplify-onboarding.md) | How do we go from "developer + code deploy" to "paste one line, live in 5 min"? (the install script) |
| [`02-distribution-funnel.md`](./02-distribution-funnel.md) | The marketing "waterflow": how do US customers find, try, and buy — with Webflow as the wedge? |
| [`03-pricing-and-differentiation.md`](./03-pricing-and-differentiation.md) | How do we price vs Intercom & Chatbase, and where's the real margin? |
| [`04-customization.md`](./04-customization.md) | How do non-technical clients customize the widget easily? |

---

## The one-line reality check

> **The #1 cause of "too complex" is that install is developer-only.** Today a customer must `npm install @neylonai/sdk`, paste a `mountSupportWidget()` call into their app shell, set an env var, and redeploy (`packages/sdk/src/embed.ts`, `apps/web/src/components/dashboard/settings/developer-section.tsx`). There is **no `<script>` embed**, **no CDN loader**, and **no CMS plugin** anywhere in the repo. A Webflow user literally cannot install Neylon today without exporting code.

Everything the reviewers said is downstream of that one fact. Fix the install surface and you simultaneously unlock the "simplicity" complaint, the Webflow channel, and a cleaner funnel.

## The strategic bet (the thesis)

**"Proactive AI customer engagement, no-code, at a fraction of Intercom/Chatbase pricing — starting with Webflow."**

Three pillars, each with a real, defensible foundation already in your codebase:

| Pillar | Your existing advantage | What's missing (the work) |
|---|---|---|
| **Simplicity** | `build-embed.mjs` already produces a self-contained Shadow-DOM bundle; public config already served via `GET /api/v1/widget-config/public`; signup already creates org + Free plan + API key. | A script-tag/CDN loader + auto-init; auto-crawl of the site on signup; a Webflow install path. |
| **Distribution** | Nothing yet — greenfield. | Webflow App/Marketplace listing; "Powered by Neylon" loop; US-focused content + directories. |
| **Price** | Gemini Flash tiers + **pgvector** RAG (no per-vector SaaS bill). Internal COGS ≈ **$0.01–$0.15 per conversation**. | Repackage/reprice; decide flat vs usage vs hybrid. |

## What makes Neylon _not_ a Chatbase clone

You are not a "paste-your-docs FAQ bot." The codebase already has features Chatbase-class tools don't lead with, and Intercom charges a fortune for:

- **Proactive suggestions engine** (teasers, behavioral triggers: scroll/dwell/exit-intent) — engagement, not just reactive Q&A.
- **Website-aware knowledge** with auto-crawl (Website integration) + **hybrid pgvector RAG** (`halfvec(3072)`, HNSW + tsvector FTS).
- **Live human handoff** to a dashboard inbox (escalation → reply), now with multi-channel contact capture (email/phone/LinkedIn).
- **Multi-channel**: WhatsApp + Cal.com integrations; voice input (STT).
- **Lead-gen framing** — the landing page already positions around "turning anonymous traffic into qualified leads."

That bundle is the differentiation story for both the funnel and the pricing docs.

## Assumptions I made (correct me if wrong)

- You're **early-stage** (solo/small team, pre- or early-revenue). Docs optimize for cheap, founder-led motion — not a sales org.
- You want to **keep the code** for India/INR/Razorpay (it exists) but **market only to the US** for now. I treat INR as "supported, not promoted."
- "Gemini 3.5/3.6 Flash for complex, lite for normal" = your actual router: `high = gemini-3.6-flash`, `medium = gemini-3.5-flash-lite`, `low = gemini-3.1-flash-lite` (`packages/agent/src/lib/models.ts`). I use those real IDs throughout.

## Master decisions for you

These are the cross-cutting calls the four docs will keep coming back to. Jot a lean on each:

1. **Install surface (biggest one):** ship a **script-tag/CDN embed** as the primary install? (Unlocks no-code + Webflow + WP + plain HTML in one move.) → `01`
2. **Webflow first, or "any site" first?** A universal script tag covers Webflow _and_ everyone; a native Webflow App is more work but better distribution. Sequence? → `01`, `02`
3. **Pricing model:** keep flat tiers, move to **per-resolution** (attack Intercom), or **hybrid** (recommended)? → `03`
4. **Reprice?** Current tiers ($0/$19/$49/$149) look **underpriced** vs the value and vs Chatbase ($40/$150/$500). Raise, or stay cheap as the wedge? → `03`
5. **"Powered by Neylon"** on free/cheap tiers + a paid removal (Chatbase charges $99/mo)? Growth loop + upsell. → `02`, `03`
6. **Dashboard-ify the code-only settings** (page targeting, tab toggles, suggested questions, proactive triggers) so non-devs can reach them? → `04`

## Suggested build order (if the bets above hold)

1. **Script-tag embed + auto-init** (`data-key` attribute) served from a CDN. _Highest leverage; unblocks everything._
2. **Auto-crawl on signup** so the bot is never empty at first load.
3. **Webflow install guide** (custom-code embed) → then a **native Webflow App**.
4. **Dashboard-ify** the top code-only customization fields + branding presets/live preview.
5. **Reprice + "Powered by" loop**, launch US funnel (Webflow marketplace, content, directories).

See each doc for the detail and the trade-offs.
