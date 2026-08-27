# Neylon AI — Proactive AI customer engagement

Neylon AI is a **proactive AI customer-engagement platform**, not only a website chatbot. It combines one tool-enabled Main Agent with website-aware knowledge, conversation memory, proactive suggestions, integrations, and an embeddable chatbot SDK — with a multi-tenant SaaS layer (subscriptions, entitlements, usage metering, payments).

Built as a **pnpm + Turborepo modular monolith**: Next.js in `apps/web`, business logic in `packages/*`.

---

## Product stack

```
apps/web  →  @neylonai/sdk (chatbot UI)  →  Neylon AI API
                                       →  @neylonai/agent
                                       →  @neylonai/domain
                                       →  @neylonai/integrations
                                       →  @neylonai/database
```

- **Chatbot UI lives only in `@neylonai/sdk`** (browser-safe, publishable). It must not depend on Next.js server APIs, Drizzle, Redis, `@neylonai/agent`, `@neylonai/domain`, `@neylonai/database`, or payment secrets.
- **First-party app UI** stays in `@neylonai/ui` (private to this monorepo — not an SDK dependency).
- **Private backend** (`domain`, `database`, `agent`, …) is reached by the SDK only through **public HTTP APIs**.
- **Business rules** (billing, entitlements, usage) live in `@neylonai/domain`, not presentation components.

---

## Features

### Engagement
- Streaming AI chat (LangGraph + Google Gemini)
- Website knowledge via Postgres/pgvector
- Proactive suggestion bubbles + optional sound
- Conversation threads and memory
- Embedded Widget Customization (Logo, Bricolage Grotesque font, Curated themes)
- Setup Wizard (1-click website crawling & AI persona generation)
- Script-tag SDK installation
- Specialized agents (plan-gated)
- CRM / notification integrations (plan-gated)
- Meeting-link sharing, team notifications

### SaaS platform
- Organizations → subscriptions → plans → entitlements → usage → API keys
- Plans: **Free** (500 credits), **Starter** (2,000), **Pro ($49 / 5,000)**, **Business ($149 / 15,000)**. Shared wallet charges Simple / Standard / Complex at **1 / 2 / 8** credits after delivery (social turns **0**). Hard query limits are Free **100/50/20**, Starter **400/200/70**, Pro **1,000/500/150**, Business **3,000/1,500/500**. Simple may borrow higher-class capacity and Standard may borrow Complex; Complex never borrows downward. Exhausted routes use Simple runtime limits. Free blocks when credits are empty; paid plans continue as metered overage. Policy: `packages/domain/src/billing/workload-policy.ts` and `plans.ts`.
- Server-authoritative entitlements (`canUseAgent`, `canConsumeConversation`, etc.)
- Client API keys for SDK embeds (`nk_live_…`) with optional origin allowlists
- Usage metering (conversations, tokens, estimated cost)
- Payments: **Stripe** (international) + **Razorpay** (India), provider abstraction for PayPal later

### Surfaces
- Marketing site + embeddable widget
- Customer dashboard (`/dashboard/*`)
- Platform admin (`/admin/*`, `role === admin`)

---

## Monorepo layout

```
apps/
  web/                     # Next.js 15 — site, dashboard, admin, API routes
packages/
  sdk/                     # @neylonai/sdk — chatbot UI + browser API client
  agent/                   # @neylonai/agent — LangGraph agent runtime
  auth/                    # @neylonai/auth — JWT sessions
  database/                # @neylonai/database — Drizzle, Redis, pgvector
  domain/                  # @neylonai/domain — users, chat, billing
  integrations/            # @neylonai/integrations — customer catalog + shared providers
  ui/                      # @neylonai/ui — shared primitives
  eslint-config/
  typescript-config/
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for dependency boundaries.

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL **with `vector` (pgvector)**
- Redis

### Install

```bash
pnpm install
cp .env.example .env
```

**One env file:** edit **repo root** `.env` only.  
`apps/web/next.config.ts` loads it from the repo root, so no per-app copy is needed.

### Database

```bash
pnpm db:migrate
```

Optional: Postgres + Redis only in Docker while using `pnpm dev` on the host:

```bash
docker compose up postgres redis -d
# .env → DATABASE_URL=postgresql://neylonai:neylonai@localhost:5432/neylonai
#            REDIS_URL=redis://localhost:6379  DATABASE_SSL=false
```

### Run

```bash
pnpm dev
# In another terminal, for website crawls:
pnpm dev:crawler
```

Open [http://localhost:3000](http://localhost:3000).

| Surface | URL |
|--------|-----|
| Landing + widget | http://localhost:3000 |
| Customer dashboard | http://localhost:3000/dashboard |
| Admin | http://localhost:3000/admin |

1. Sign in with Google (creates org + **Free** plan + API key).
2. Dashboard requires a session; admin requires `user.role = 'admin'`.

### Promote an admin

New users are `role = user`. After first login:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

Sign out and sign back in so the JWT session refreshes.

### Platform landing widget

The site layout auto-provisions a **publishable** client API key (`nk_live_…`)
for the admin user’s organization (or `PLATFORM_ADMIN_EMAIL` /
`KNOWLEDGE_ORGANIZATION_SLUG` fallback). No seed script required.

Optional override in `.env`:

```bash
NEXT_PUBLIC_NEYLONAI_API_KEY=nk_live_…
# or NEYLONAI_SITE_API_KEY=nk_live_…
```

Client keys are browser-visible by design. Never put `AUTH_SECRET`, database
URLs, Gemini keys, or payment secrets in `NEXT_PUBLIC_*`.

---

## Dashboard & admin routes

### Customer (`/dashboard`)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Overview |
| `/dashboard/widget` | Coding agent widget setup |
| `/dashboard/knowledge` | Knowledge documents |
| `/dashboard/conversations` | Threads |
| `/dashboard/agents` | Enable/disable agents (plan-gated) |
| `/dashboard/integrations` | CRM / integrations |
| `/dashboard/usage` | Quotas and metering |
| `/dashboard/billing` | Plan, checkout, cancel |
| `/dashboard/developer` | API keys, origins, SDK install |
| `/dashboard/settings` | Account / org |

### Admin (`/admin`)

| Route | Purpose |
|-------|---------|
| `/admin` | Platform KPIs (orgs, MRR/ARR, credits, workload mix, COGS) |
| `/admin/organizations` | Tenants |
| `/admin/users` | Accounts |
| `/admin/subscriptions` | Plan / status |
| `/admin/api-keys` | Key inventory (prefix only) |
| `/admin/unit-economics` | Workload budgets & plan quotas |

Dashboard type uses **Banda Nova Book** (`apps/web/src/assets/fonts/BandaNova-Book.woff2`, loaded via `src/assets/fonts.ts`) — medium weight for titles, no Palo.

---

## Billing & entitlements

- Entitlement catalog: `packages/domain/src/billing/plans.ts` (change limits here, not in routes).
- Eligible subscription statuses for chatbot API: `trialing`, `active`.
- Checkout: `POST /api/v1/billing` (dashboard). Paid plans activate only after **webhooks**.
- Webhooks:
  - `POST /api/v1/billing/webhooks/stripe`
  - `POST /api/v1/billing/webhooks/razorpay`

Useful env vars (optional until you take payments / analytics):

```bash
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_STARTER=
RAZORPAY_PLAN_PRO=
RAZORPAY_PLAN_BUSINESS=

```

Never put payment or provider secrets in the SDK / browser. The SDK only uses the **client API key**.

---

## Embed the chatbot (SDK)

Anonymous visitors work with only a publishable API key. Widget branding and
behavior are managed in the Neylon dashboard and loaded by the SDK automatically
— do not configure colors, fonts, logo, or theme in client code. The SDK owns
the backend URL.

```tsx
import { SupportWidget } from "@neylonai/sdk/react";

<SupportWidget
  config={{
    apiKey: "nk_live_…", // from Settings → Security
  }}
/>
```

Optional: pass `pagePath`, and when your app already has a signed-in user, map
`user: { id, name, email, profile_image? }` from **existing** auth — do not
create a Neylon-specific login.

| Mode | Pass | Result |
| ---- | ---- | ------ |
| Anonymous | `apiKey` | Chat works; dashboard branding loads |
| Authenticated | `apiKey` + `user` from existing session | Personalized |

See [`skill.md`](./skill.md).

---

## Knowledge base (pgvector)

Chunks are `halfvec(3072)` (Gemini `gemini-embedding-001`) with HNSW cosine, scoped by organization + knowledge base.

```bash
# Re-embed knowledge chunks with Gemini (after changing embedding model / dims)
DATABASE_URL=... DATABASE_SSL=false GEMINI_API_KEYS=... \
  pnpm --filter @neylonai/agent run reembed:knowledge
```

Defaults for **local/dev scripts only**: `KNOWLEDGE_ORGANIZATION_SLUG=neylonai`, `KNOWLEDGE_BASE_SLUG=organization_data`.
Production widget/API requests resolve the organization from the authenticated API key, then the org-owned knowledge base — never from these env slugs.

---

## Docker

### Full local stack (bundled Postgres + Redis)

```bash
# .env (compose network hostnames):
# DATABASE_URL=postgresql://neylonai:neylonai@postgres:5432/neylonai
# REDIS_URL=redis://redis:6379
# DATABASE_SSL=false

pnpm docker:up
pnpm db:migrate   # from host against localhost:5432
```

### Cloud DB + Redis

```bash
# .env → Supabase transaction pooler as DATABASE_URL (:6543),
#             Direct as DATABASE_DIRECT_URL (:5432), REDIS_URL, DATABASE_SSL=true
pnpm db:migrate   # uses DATABASE_DIRECT_URL
pnpm docker:cloud
```

### Vercel

Deploy `apps/web`. Set `DATABASE_URL` to Supabase **transaction** pooler (`:6543`) and `DATABASE_DIRECT_URL` to **Direct** (`:5432`). Run `pnpm db:migrate` once against the direct URL (never against `:6543`).

---

## Scripts

```bash
pnpm dev           # Next.js on :3000
pnpm build         # production build
pnpm start         # serve production build
pnpm check-types
pnpm lint
pnpm db:migrate
pnpm db:generate
pnpm db:studio
```

---

## License

MIT
