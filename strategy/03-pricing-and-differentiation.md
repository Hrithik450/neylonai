# 03 — Pricing & Differentiation

_Answers: how to price vs Intercom & Chatbase, how to differentiate, and how to exploit your cost advantage (Gemini Flash + pgvector). All competitor numbers are live as of Aug 2026; verify at signup time before publishing._

## The core insight

**Your cost to serve a conversation is a fraction of what competitors charge per conversation.** That gap is the entire strategy. It lets you either (a) undercut hard and win on price, or (b) price at a healthy midpoint and keep fat margins. You do **not** have to race to the bottom — you have room to do both.

## Competitor landscape (live, Aug 2026)

### Intercom (the incumbent, premium)
- **Seats:** Essential **$29** / Advanced **$85** / Expert **$132** per seat/mo.
- **Fin AI Agent:** **$0.99 per resolution** (charged once per resolved conversation), available standalone (no seats), typical minimum ~50 resolutions/mo.
- 14-day trial; aggressive startup program (up to 93% off + 1 yr Fin free).
- **Position:** full support suite, expensive, sold to funded teams. **$0.99/resolution is the number to beat.**

### Chatbase (the closest analog / "cheap AI bot")
- **Free** $0 (50 credits) · **Hobby $40**/mo (700 credits) · **Standard $150**/mo (4,000) · **Pro $500**/mo (15,000) · **Enterprise** custom.
- Overage ~**$0.04/credit** ($40 per 1,000). Extra agent **$25**/mo. **Remove "Powered by Chatbase" branding: $99/mo.** ~20% off annual.
- **Position:** self-serve AI chatbot, credit-metered. **Your current tiers are far cheaper than this — possibly too cheap.**

### Your Gemini input costs (per 1M tokens, for context)
- gemini-3.6-flash (your "high"/complex): ~$0.75/$3.75 (promo) to $1.5/$7.5 (internal conservative book).
- gemini-3.5-flash-lite ("medium"): ~$0.30/$2.50. · gemini-3.1-flash-lite ("low"): ~$0.25/$1.50.
- gemini-embedding-001: ~$0.15/1M. **pgvector = $0 per-vector SaaS fee** (you host it) — a structural cost edge over anyone paying Pinecone/Weaviate.

## Your unit economics (why this works)

Using the **internal conservative COGS book** (higher than public Gemini list, so margins are understated = safe):

| Turn type | Model | Est. COGS / turn |
|---|---|---|
| Simple (FAQ, greeting) | 3.1-flash-lite | ~**$0.001** |
| Standard | 3.5-flash-lite | ~**$0.003** |
| Complex (reasoning, multi-step) | 3.6-flash | ~**$0.10** |

**Per conversation** (several turns): ~**$0.01** (pure FAQ) to ~**$0.106** (a mixed conversation with one complex turn). Even a heavy conversation is **~10–11¢**.

Compare: Intercom charges **$0.99** per resolution; Chatbase effectively **~$0.15**/conversation-equivalent at list credit prices. **You serve the same conversation for ~1–11¢.** That's a 5–90× cost gap depending on complexity.

### Margin at current prices (full-quota worst case)

Even if a customer maxes their **class quotas** every month (worst case for you):

| Plan | Price | Max COGS at full quota | Gross margin (worst case) |
|---|---|---|---|
| Free | $0 | ~$2.25 | (acquisition cost — capped, fine) |
| Starter | $19 | ~$8 | ~58% |
| Pro | $49 | ~$17.50 | ~64% |
| Business | $149 | ~$57.50 | ~61% |

**And typical utilization is nowhere near full quota** → real-world margins are **85%+**. The takeaway: your current prices are *safe*, and there's headroom to raise them.

## The differentiation story (what you charge FOR)

Price follows positioning. Don't sell "a cheaper chatbot" — sell a **category difference**:

> **"Proactive AI customer engagement + lead capture — at FAQ-bot prices."**

| | Intercom | Chatbase | **Neylon** |
|---|---|---|---|
| Reactive Q&A | ✅ | ✅ | ✅ |
| **Proactive engagement** (teasers, scroll/dwell/exit triggers) | partial (paid) | ❌ | ✅ **core** |
| **Lead capture / anonymous-visitor → lead** | add-ons | limited | ✅ **core** |
| Live human handoff to inbox | ✅ (pricey) | limited | ✅ |
| Multi-channel (WhatsApp, Cal.com, voice) | ✅ (pricey) | limited | ✅ |
| No-code install *(once [`01`](./01-simplify-onboarding.md) ships)* | ✅ | ✅ | ✅ |
| **Entry price** | $$$ ($85+/seat) | $$ ($40–$500) | **$ (cheapest)** |

Your two real wedges vs Chatbase: **proactive engagement** and **lead gen** (Chatbase is mostly reactive support). Your wedge vs Intercom: **price + simplicity + no per-seat tax.**

## Pricing model — three options

### Option 1 — Keep flat tiers (simplest)
Stay with $0/$19/$49/$149, differentiated by conversations + credits + class quotas + advanced-proactive gating.
- **Pro:** simplest to sell/understand; predictable bill for the customer; you're the obvious cheap pick.
- **Con:** leaves money on the table (you're way under Chatbase); "credits/quotas" are hard for non-technical buyers to reason about.

### Option 2 — Per-resolution (attack Intercom head-on)
Charge per resolved conversation, e.g. **$0.20–$0.49/resolution** vs Intercom's $0.99 — a 50–80% undercut with still-huge margin (COGS ~1–11¢).
- **Pro:** devastating comparison in sales content ("half the price of Fin"); aligns cost to value; scales with the customer.
- **Con:** unpredictable bills scare small buyers; needs a clean, honest definition of "resolution"; billing complexity.

### Option 3 — Hybrid (flat base + included volume + overage)  ⭐ recommended
A flat monthly tier that **includes** N conversations/resolutions, then simple overage — the model Chatbase-class buyers already understand, but priced under them.
- **Pro:** predictable for the customer, expands with usage, easy to show "cheaper than Chatbase *and* Intercom." Matches your existing credits/quotas machinery (you already meter usage + on-demand billing for paid plans).
- **Con:** slightly more to explain than pure flat — but a good pricing page solves that.

## Proposed repricing (illustrative — for your evaluation, not final)

Anchored to be **clearly under Chatbase** while capturing more than today, hybrid style:

| Tier | Proposed | Includes | Overage | vs Chatbase | Notes |
|---|---|---|---|---|---|
| **Free** | $0 | ~50 convos, "Powered by Neylon" on | — | = their free | Acquisition + viral loop |
| **Starter** | ~$29 (from $19) | ~500 convos | ~$0.03/extra | vs Hobby $40 | Founder/indie tier |
| **Pro** | ~$79 (from $49) | ~2,500 convos, advanced proactive, **remove branding** | ~$0.02/extra | vs Standard $150 | The "everything" tier for most |
| **Business** | ~$199 (from $149) | ~15,000 convos, priority, multi-site | ~$0.015/extra | vs Pro $500 | Scaling teams |
| Enterprise | Custom | — | — | vs Enterprise | Later |

Even after raising prices you remain **~40–60% cheaper than Chatbase at every tier**, and margins stay well above 80% at typical use. Numbers are a starting point — tune to the conversation volumes you actually see.

## Extra monetization levers (cheap wins)

- **Remove "Powered by Neylon" branding** — bundle into Pro+, or offer as a **$99/mo** add-on on cheaper tiers (Chatbase's exact number). Pure margin + it funds the viral loop. Ties to [`02`](./02-distribution-funnel.md).
- **Extra seats / team members** (Chatbase charges $25/seat) — a lever if your handoff inbox is multi-user.
- **Annual billing ~20% off** — improves cash + retention; industry standard.
- **Startup program** — mirror Intercom's discount move on a small scale (e.g. 50% off year one for early-stage) to win logos and testimonials.

## Cost-control guardrails (protect the margin)

Your margin depends on the **model router** keeping complex (expensive) turns rare. Protect it:
- Keep routing tuned so only genuinely hard turns hit gemini-3.6-flash; most traffic should be lite models (~$0.001–0.003/turn).
- Watch the **complex-turn %** per account; a pathological account (all-complex) still only costs ~$0.10/convo but caps should exist.
- pgvector self-hosting keeps RAG at near-zero marginal cost — protect that infra choice; it's a structural moat vs vector-DB-SaaS competitors.

## Keep INR / Razorpay?

- **Decision:** *Keep the code, don't promote it.* Default the marketing site + checkout to **USD/Stripe**. Leave Razorpay wired for any existing India users or inbound, but don't feature INR pricing publicly. Zero code to remove; just a marketing/default-currency choice. (See [`02`](./02-distribution-funnel.md).)

## Decisions for you

1. **Which model — flat / per-resolution / hybrid?** (Recommended: **hybrid**, Option 3.)
2. **Reprice, or stay ultra-cheap as the wedge?** (Recommended: modest raise per the table — you're leaving margin *and* perceived value on the table at $19/$49/$149.)
3. **If per-resolution or hybrid:** what's the honest definition of a "resolution/conversation" that you'll bill on and show on the pricing page?
4. **"Powered by Neylon" removal** — bundled in Pro+ or a standalone $99/mo add-on (or both by tier)?
5. **Annual discount** (~20%) and a **startup program** — in for launch?
6. **Confirm USD-default / keep-INR-code** stance.
7. **Build a public `/pricing` page** — none exists today; it's a prerequisite for the whole self-serve funnel in [`02`](./02-distribution-funnel.md).
