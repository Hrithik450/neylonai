# 02 — Distribution & Funnel (the "marketing waterflow")

_Answers reviewer points #3 ("build Webflow plugins — US SaaS runs on Webflow") and #4 ("target the US, not India"), and your ask for a distribution/funnel/marketing flow._

> Prerequisite: this whole doc assumes the **one-line script install** from [`01`](./01-simplify-onboarding.md) exists. Without it, none of these channels convert — a Webflow user who clicks "Install" still hits an npm wall. Install simplicity **is** the distribution strategy's foundation.

## Who we're selling to (US-only ICP)

Narrow beats broad for a solo/early team. Proposed beachhead:

- **US-based B2B & B2C SaaS**, seed → Series A, **marketing site on Webflow** (or Framer/WordPress).
- 1–20 people, **no dedicated support team**, founder or a generalist handles support + a lot of pre-sale questions.
- They feel two pains Neylon already solves: (a) **losing anonymous website visitors** who bounce with unanswered questions, and (b) **can't afford Intercom's seats** ($85–$132/seat) but want more than a dumb FAQ bot.

Why this ICP: it maps to features you already have (proactive engagement, lead capture, website RAG, handoff), it's reachable through **one channel — Webflow** — and it's exactly who the reviewer pointed at.

## The wedge: Webflow

Most US SaaS marketing sites are on Webflow, and Webflow has a **marketplace + App ecosystem** where these exact buyers shop for add-ons. Two ways in, in order of effort:

1. **Install guide first (day one, ~free):** a documented "Add Neylon to Webflow" path = paste the Option-A script into Webflow's *Custom Code → Footer* (or an Embed element). This works **today** the moment the script exists. Write it up, record a 90-second Loom, done.
2. **Native Webflow App (the real wedge):** a listed app in the Webflow Marketplace that installs the widget for the user (injects the script, links the API key via OAuth) — no copy-paste. This gets you **discovery inside Webflow's own store**, co-marketing, and credibility. Higher effort; do it after the script + guide validate demand.

Webflow is the **tip of the spear**, not the whole spear — the same script drops into Framer, WordPress, Squarespace, Shopify, and raw HTML, so each is a follow-on paste-guide with near-zero marginal work.

## The funnel ("waterflow"), stage by stage

```
        AWARENESS                ACQUISITION            ACTIVATION            REVENUE              REFERRAL
   Webflow marketplace  →   Free signup (no CC)  →  Paste script, →   Hit value → upgrade  →  "Powered by
   Content / SEO             Auto-crawl site         bot answers +      (proactive/leads,       Neylon" badge
   Directories / launch      → key in hand           captures a lead    remove branding,        → visitor sees
   "Powered by" backlinks                            in <10 min         quota)                  → clicks → signs up
```

### 1. Awareness — how US buyers first hear about Neylon
- **Webflow Marketplace/App listing** (primary; buyers with intent are already there).
- **SEO / comparison content** aimed at bottom-funnel queries: "Intercom alternative for startups," "cheap AI chatbot for Webflow," "Chatbase vs …," "AI support widget for SaaS." You have a real, honest angle: *proactive engagement + lead capture at FAQ-bot prices.*
- **Launch surfaces:** Product Hunt, relevant subreddits, indie/SaaS communities, Webflow community/showcase.
- **Directories:** AI tool directories, "Webflow integrations" lists, chatbot comparison sites.

### 2. Acquisition — friction-free trial
- **Free plan, no credit card** (you already provision org + Free + API key on signup — lean into it).
- Signup asks for the site URL → **auto-crawl kicks off** (see [`01`](./01-simplify-onboarding.md)) so the bot has knowledge before they even install.

### 3. Activation — the "aha" in one session
- Define activation crisply: **script pasted + bot answers a real question + first lead/handoff captured.** That's the moment they believe it.
- Onboarding overlay (the 8-step spotlight already in the dashboard) should drive to exactly that, and celebrate the first captured lead.

### 4. Revenue — natural upgrade triggers
- Free tier is generous enough to prove value but capped (conversations/credits + class quotas). Upgrades trigger on: **volume**, **advanced proactive** (already Pro/Business-gated), **remove "Powered by Neylon"**, and **lead volume**. Pricing detail in [`03`](./03-pricing-and-differentiation.md).

### 5. Referral / viral loop — "Powered by Neylon"
- Free/cheap tiers show a small **"Powered by Neylon"** link in the widget. Every customer's site becomes a storefront; their visitors (often other SaaS founders) click through → signup. Removing the badge is a **paid upgrade** (Chatbase charges $99/mo for exactly this — see [`03`](./03-pricing-and-differentiation.md)).
- This is the cheapest growth loop you have and it compounds with every install.

## Channel priority (effort × leverage)

| Channel | Effort | Leverage | When |
|---|---|---|---|
| Webflow install **guide** + Loom | Low | High (unblocks the wedge) | Now, with the script |
| "Powered by Neylon" loop | Low | High (compounding) | Now (needs branding toggle) |
| SEO comparison/alternative content | Med | High (durable inbound) | Ongoing, start now |
| Product Hunt / community launches | Low–Med | Med (spiky) | At script + reprice launch |
| **Native Webflow App** | High | High (discovery + trust) | After guide validates demand |
| Agencies/freelancers channel | Med | High (multiplier) | Once retention proven |
| WordPress/Framer/Shopify guides | Low each | Med each | Fast-follow the script |
| Paid ads | Med–High | Unknown (needs LTV data) | Only after funnel math is known |

## The agency multiplier (underrated)

Webflow/Framer **agencies and freelancers** build many client sites. Land one agency → they install Neylon on **every** client build. A simple referral/partner arrangement (revshare or a partner tier with client management) turns one relationship into dozens of installs. Pursue once you've proven customers stick.

## What to measure (funnel KPIs)

- **Acquisition:** signups/week by source; Webflow-attributed share.
- **Activation:** % of signups that paste + get a live answer + capture a lead (target the biggest early lever here).
- **Time-to-live:** target < 10 min from signup to first answer.
- **Retention:** week-4 widget-still-installed %, monthly conversation volume trend.
- **Revenue:** free→paid conversion %, MRR, ARPU.
- **Loop:** click-throughs on "Powered by Neylon" → signups (viral coefficient).

## US-only: what "target the US" actually means operationally

You already support USD/Stripe. To *market* US-only without ripping out India code:

- **Default currency USD**, Stripe as primary checkout; keep Razorpay/INR wired but **don't feature it** (see [`03`](./03-pricing-and-differentiation.md) for the keep-INR-code decision).
- **Positioning, testimonials, examples, and pricing page all in USD / US context.** Time zones and support hours framed US.
- Content + directories US-oriented; Webflow skews US/Western SaaS anyway, so the wedge naturally selects for it.
- (Optional later) geo-target the marketing site / ads to US + English-speaking Western markets.

## Decisions for you

1. **Confirm the beachhead ICP** = US SaaS on Webflow, <20 people, no support team. Narrow further (B2B only?) or widen?
2. **Webflow sequencing:** ship the **install guide** immediately (needs only the script), and schedule the **native App** for after — agree?
3. **"Powered by Neylon" loop:** turn it on for Free (and Starter?) with paid removal? (Recommended: yes.)
4. **Which 2–3 awareness channels** do we actually staff first? (My pick: Webflow guide + SEO comparison content + one Product Hunt launch at reprice.)
5. **Agency partner program** — worth a lightweight v1 now, or wait for retention proof? (Recommended: wait, but design pricing so it's easy to add.)
6. **INR/India:** keep code, stop marketing — confirm. Any existing India customers to grandfather?
