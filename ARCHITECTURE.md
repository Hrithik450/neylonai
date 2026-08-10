# Architecture

Neylon AI is a **modular monolith**: one deployable Next.js app, with clear package boundaries enforced by the workspace.

## Dependency graph

```
apps/web                    (private first-party app)
  ├── @neylonai/sdk         ← PUBLIC / publishable (browser SDK only)
  ├── @neylonai/ui          (private app UI kit — not an SDK dependency)
  ├── @neylonai/auth
  ├── @neylonai/database
  ├── @neylonai/domain
  ├── @neylonai/integrations
  └── @neylonai/agent
        ├── @neylonai/domain
        ├── @neylonai/database
        └── @neylonai/integrations

@neylonai/domain            (private)
  └── @neylonai/database

@neylonai/integrations      (private)
  └── (external adapters only: Gemini, Tavily, Evently, …)

@neylonai/sdk               PUBLIC — zero @neylonai/* workspace deps
  └── public npm only (react peers, lucide, zustand, radix, …)

@neylonai/auth              (private)
@neylonai/ui                (private app shared UI)
```

```
External Client ──► @neylonai/sdk ──► Neylon Public API ──► Private backend
                                              ├── Billing / Domain
                                              ├── Database
                                              ├── AI services
                                              └── Secrets

First-party frontend ──► @neylonai/sdk ──► Neylon Public API
                     └── (app-only) private packages for dashboard/admin/API routes
```

Rules:

1. Apps may import packages. Packages never import apps.
2. **`@neylonai/sdk` is the only publishable package.** It must never depend on
   `@neylonai/domain`, `@neylonai/database`, `@neylonai/agent`, `@neylonai/auth`,
   `@neylonai/integrations`, or other private Neylon packages.
3. Widget/integration code in `apps/web` must import the chatbot only from
   `@neylonai/sdk` / `@neylonai/sdk/react` (plus the app’s own modules). Do not
   import private domain/billing into the SupportWidget integration path.
4. Private backend capabilities the SDK needs are exposed via **public HTTP APIs**,
   never by importing private packages into the SDK.
5. Each package exposes a single public entry (`exports: { ".": "./src/index.ts" }`).
   Deep imports into another package's internals are unsupported.
6. Prefer feature folders inside a package (`domain/users`, `domain/chat`) over
   creating a new package for every small concern.
7. Postgres/pgvector SQL stays inside `@neylonai/database`. UI never imports `pg` /
   Drizzle / vector operators directly. Agent feature persistence and first-party
   knowledge search may use `@neylonai/database` table/search APIs; raw vector
   operators stay behind those helpers.

## Package responsibilities

| Package | Role |
|---|---|
| `@neylonai/ui` | Private app UI primitives (dashboard/admin/landing) — **not** an SDK dependency |
| `@neylonai/database` | Postgres (Drizzle) + Redis + **knowledge (pgvector + FTS)** |
| `@neylonai/auth` | Session JWT + IdP token verification (Google today; no Next.js imports) |
| `@neylonai/integrations` | Customer integration modules (Website, PDF, Slack, …) + **internal** shared tools (scrape, Gemini, web-search, notifications, CRM adapter protocol). Catalog registry drives UI + billing. |
| `@neylonai/domain` | Users, chat, conversation lifecycle / handoff, tickets, billing, knowledge sources |
| `@neylonai/agent` | Agent registry + streaming orchestrator (Support, Lead Agent, **first-party knowledge search**, escalation) |
| `@neylonai/sdk` | **Public** browser SDK: SupportWidget + API client (zero `@neylonai/*` runtime deps) |
| `apps/web` | Next.js routes, landing, cookie glue, dashboards (uses SDK for widget; private packages for APIs) |

## Knowledge retrieval (pgvector)

First-party Postgres storage for org knowledge (no external vector DB).

**Why this shape**

- Stored embeddings are Gemini `gemini-embedding-001` at **3072** dims (unit-normalized at full width; free tier).
- pgvector `vector` HNSW maxes at 2000 dims → store as **`halfvec(3072)`** (HNSW up to 4000 dims, ~½ storage).
- Distance: **cosine** (`<=>` / `halfvec_cosine_ops`) — correct for normalized text embeddings.
- Index: **global HNSW** (`m=16`, `ef_construction=64`) on `knowledge_chunks.embedding`.
- Queries run inside a **single DB transaction** that sets `hnsw.ef_search` (default 100), `hnsw.iterative_scan=relaxed_order`, and `hnsw.max_scan_tuples` (default 20_000) so tenant filters still fill `LIMIT`.
- Chat model **router** (complexity → tier): low `gemini-3.1-flash-lite`, medium `gemini-3.5-flash`, high/max `gemini-3.6-flash`. Classification prefers zero-latency heuristics; otherwise `gemini-3.1-flash-lite` JSON classify (`ROUTER_CLASSIFIER_MODEL`). Utility `gemini-3.5-flash-lite` (expansion / reframe / titles). No OpenAI.
- **Model IDs** — `packages/agent/src/lib/models.ts` (defaults + remaps retired IDs like `gemini-2.5-flash-lite` → `gemini-3.1-flash-lite` at runtime).
- **Google API key pool** (`@neylonai/integrations/gemini`): `GOOGLE_API_KEYS` (or `GOOGLE_API_KEY_1…N` / legacy `GOOGLE_API_KEY`). Round-robin across keys; on 429/quota the key cools down (`GOOGLE_API_KEY_COOLDOWN_MS`) and calls retry on the next key via `withGoogleApiRetry`.

**Multi-tenant schema**

`organizations` → `organization_integrations` (`type` + `config`) → `knowledge_sources` (`type` + `integration_id` FK) → `knowledge_documents` → `knowledge_chunks`  

A source answers: which catalog integration it belongs to (`type`), and which org connection row holds credentials (`integration_id`). Connector catalog (Website, PDF, Drive, CRM, …) lives in `@neylonai/integrations` manifests.

**Modular APIs in `@neylonai/database`**

- `searchKnowledgeByVector` — ANN / HNSW (tenant-filtered, transaction-scoped GUCs)
- `searchKnowledgeByKeyword` — PostgreSQL FTS (`tsvector` + `ts_rank_cd`) for BM25-like keyword retrieval
- `resolveKnowledgeScope({ organizationId })` — authenticated org + embedding defaults (production)
- `resolveDevKnowledgeScope` — env org slug; **scripts / local only**, never request handlers
- `listKnowledgeSuggestionSeeds` — org candidate samples for proactive suggestions
- `pnpm --filter @neylonai/database bench:vector-search` — filtered-ANN latency micro-benchmark

**Default knowledge search** (`@neylonai/agent` `infrastructure/knowledge-search`, postgres provider) uses Gemini query expansion → `gemini-embedding-001` → vector top-k → dedupe. It does not call keyword search unless you compose hybrid ranking later. The agent tool uses `knowledgeSearchProviders.getDefault()`.

If you change embedding model or dimensions, run `reembed:knowledge` (via `@neylonai/agent`) so stored vectors match query embeddings.

### Multi-tenant vector strategy (scale tiers)

Plan catalog caps today: free ~200 chunks → business ~80k chunks per org (`packages/domain` `knowledgeChunksApprox`). Until measured evidence says otherwise we stay on **one table + one global HNSW**.

| Tier | When | Architecture |
|------|------|----------------|
| **A — current** | Global vectors ≲ ~2–5M; typical tenant share ≳ 0.1%; p95 ANN ≲ 50–80ms after embed | Global HNSW + mandatory `organization_id` filters (+ agent `sourceIds`) + `iterative_scan=relaxed_order` |
| **B — hot-tenant isolation** | One tenant ≫ others (e.g. ≥ ~500k–1M chunks) **or** that tenant’s filtered p95 / underfill rate degrades while others are fine | Separate physical table or list-partition for **that** org only; local HNSW; same API surface |
| **C — many large tenants** | Many orgs each large, or global HNSW RAM/build becomes the bottleneck | Declarative partitioning (list/hash by `organization_id`) with **per-partition HNSW**; still no external vector DB |
| **D — infra change** | Postgres/pgvector demonstrably saturates after A–C (RAM, build time, write amp) | Only then evaluate DiskANN/pgvectorscale or a dedicated vector store |

**Why not partition/index-per-tenant now**

- Small tenants would pay CREATE INDEX / vacuum / planner overhead for tiny graphs.
- Partial HNSW indexes per org explode catalog size and write amplification.
- pgvector 0.8+ iterative scans exist specifically for filtered ANN over a shared index.
- Security already depends on mandatory tenant `WHERE` clauses, not on physical isolation.

**Bottleneck to watch:** HNSW returns globally promising candidates; filters discard other tenants; iterative scan continues until `LIMIT` or `max_scan_tuples`. Latency grows when a tenant’s share of the global index is tiny. Track `tenantChunks / globalChunks`, ANN p95, and underfilled result counts (`bench:vector-search`).

**Progressive migration (no big-bang rebuild)**

1. Keep writing all tenants to `knowledge_chunks` + global HNSW.
2. When a tenant trips Tier B criteria: `CREATE TABLE … (LIKE knowledge_chunks INCLUDING …)` or `ATTACH PARTITION`, backfill that org’s rows (`INSERT … SELECT`), build local HNSW `CONCURRENTLY`, dual-read until checksums match, cut search routing in `searchKnowledgeByVector`, then delete from the global table.
3. Tier C: convert to partitioned parent when several tenants need isolation — attach existing whale tables as partitions; default partition holds everyone else.
4. Never drop mandatory `organization_id` filters, even on isolated storage.

**Benchmark plan**

1. Seed / import multi-tenant mixes: many small (≤2k), few medium (15k), one whale (80k–1M).
2. Run `bench:vector-search` per scope; record p50/p95/p99, hit fill rate, tenant share.
3. `EXPLAIN (ANALYZE, BUFFERS)` one ANN query with and without the transaction-scoped GUCs.
4. Promote architecture tier only when underfill rate or p95 crosses product SLO — not when global row count alone looks large.

## Clean Architecture — where we use it

Only `@neylonai/agent` uses explicit domain / application / infrastructure layers, because it is the most complex and most extensible module:

- `domain/` — `AgentDefinition` contract + registry
- `application/` — model router, thinking tips, graph builder, query reframe, stream orchestrator
- **Proactive suggestions (first-party engagement — not an external integration):**
  - Build: `packages/agent/src/agents/default/proactive-suggestions/` (`buildProactiveSuggestions`, owned by Support / default chatbot)
  - Flow: org/KB `listKnowledgeSuggestionSeeds` (candidates) → visitor/page/session ranking → 3–5 suggestions; Evently records impressions only
  - API: `apps/web/src/app/orchestration/api/v1/suggestions` (thin route → `@neylonai/agent`)
  - Widget UI: `packages/sdk/src/react/proactive/` (bubbles, idle/cooldown, sound; anonymous visitor/session ids)
  - May call Gemini via `@neylonai/integrations/gemini`
- **Knowledge search (first-party — not an external integration):**
  - `packages/agent/src/infrastructure/knowledge-search/` (`knowledgeSearchProviders`, postgres/pgvector provider)
  - Tool: `semantic_search` → private org knowledge base
  - Contrasts with `web_search` → `@neylonai/integrations/web-search` (Tavily / open internet)
  - May call Gemini via `@neylonai/integrations` for embeddings + query expansion
- **Prompts / model IDs** — single source in `packages/agent/src/lib/` (`prompts.ts`, `models.ts`). Gemini key pooling stays in `@neylonai/integrations/gemini`.
- `infrastructure/tools/` — LangChain tools (thin wrappers over agent knowledge-search / integrations / domain)
- `agents/default/` — Support chatbot (answers + escalate_to_human; **no lead capture**) + proactive suggestion builder
- `agents/lead/` — dedicated Lead Agent (`capture_lead` + `persistence/` for lead upsert/list)
- `application/escalation.ts` — deterministic handoff detection (no chain-of-thought)
- `application/lead-capture-bridge.ts` — orchestrator bridge when Lead Agent is enabled

Other packages stay flat and readable (repository + service + types).

## Lead Agent → conversation → lead

```
Visitor message
  → streamConversation (org-scoped)
  → Lead Agent enabled? maybeCaptureLeadFromUserMessage / capture_lead tool
  → @neylonai/agent agents/lead/persistence (upsert into `leads`, keyed by org + thread_id)
```

- Lead capture **and** lead persistence live only on the **Lead Agent** feature (+ thin orchestrator bridge).
- Lead enablement + `leadFields` are stored on `organization_agents` (`agent_id = lead`) and edited under **Agents → Lead Agent** — not Settings / engagement.
- Support / chatbot agent must **not** call lead tools or own lead storage.
- Conversation lifecycle (`conversation_states`) does **not** store `lead_id` — join via `leads.thread_id` when the inbox needs lead context.
- Leads are workspace-scoped and independently enable/disableable via `organization_agents` (`lead`).
- CRM sync is adapter-based later — status stays `not_configured` until then.

## AI Agent → escalation → async support ticket

```
Visitor message
  → detectEscalation (explicit human / frustration / unhelpful / …)
  → OR chatbot tool escalate_to_human
  → @neylonai/domain escalateConversation
  → createTicketFromEscalation (transcript + reason + timestamp in context_snapshot)
  → status: escalated, ai_paused = true
  → notify TEAM_WEBHOOK_URL / workspace webhook (best-effort)
  → customer message: ticket submitted for follow-up + Reference: XXXXXXXX
     (never claims a human is online or chatting live)
```

This is **not** live agent chat. Dashboard Conversations shows the linked ticket status; teammates assign/resolve tickets offline.

Conversation lifecycle statuses: `ai_active` → `escalated` (ticket open) → `human_active` (teammate working ticket) → `resolved` (or `returnToAi` → `ai_active`).

## Human Agent → resolution

```
Dashboard / API assignConversation | markHumanReplied
  → status human_active, ai_paused stays true
  → resolveConversation → resolved
```

When a human sends a message, AI remains paused until `returnToAi`.

## How to add a new agent

1. Create `packages/agent/src/agents/<name>/definition.ts` implementing `AgentDefinition`.
2. Register it in that folder's `index.ts` via `registerAgent(...)`.
3. Import the new agent module from `packages/agent/src/index.ts` (side-effect import).
4. Call `streamConversation({ agentId: "<id>", ... })` from a route — or set it as default with `setDefaultAgent`.

No changes to the orchestrator or graph builder are required.

## How to add a new integration (e.g. HubSpot CRM)

1. Pick the right contract under `packages/integrations/src/`:
   - `web-search` — open internet search (Tavily)
   - `notifications` — outbound alerts (Slack today; CRM plugins fit here)
   - `crm` — lead sync adapters (`registerCrmAdapter`) for HubSpot/Salesforce later
   - `gemini` / `evently` — vendor clients
2. Add `providers/<vendor>.ts` implementing the interface.
3. Register it with the category registry (`notificationProviders.register(...)`).
4. Optionally `setDefault(...)` if it should replace the current default.

First-party knowledge retrieval is **not** an integration — add providers under `packages/agent/src/infrastructure/knowledge-search/`.
Dashboard / widget sign-in IdPs are **not** integrations — add them under `packages/auth/src/identity/`.

Consumers (agent tools, API routes) call `*.getDefault()` / `*.get(name)` and never import vendor SDKs directly.

## Framework vs business logic

- Next.js-specific code (`cookies()`, `NextRequest`, route handlers, React UI) stays in `apps/web`.
- JWT crypto + IdP verification live in `@neylonai/auth`; cookie I/O lives in `apps/web/src/server/auth-cookies.ts`.
- Route handlers should parse the request, call one package function, and shape the response.

## Deployment note

If deploying on Vercel, set the project **Root Directory** to `apps/web`. Ensure the managed Postgres has `CREATE EXTENSION vector`. Local/VPS Docker uses `pgvector/pgvector:pg16`.

**Supabase + Vercel:** use the **transaction** pooler (`:6543`, Supavisor or dedicated PgBouncer) as `DATABASE_URL` for the app. Use the **direct** connection (`db.*.supabase.co:5432`) as `DATABASE_DIRECT_URL` for `pnpm db:migrate` / drizzle-kit. The app pool defaults to `max: 1` on Vercel / `:6543` so multiplexing stays in Supabase’s pooler — do not run migrations against the transaction endpoint.
