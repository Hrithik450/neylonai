# Database migrations

## Commands

From repo root (loads `.env.local`):

- `pnpm db:migrate` — apply pending SQL migrations (requires `DATABASE_DIRECT_URL`, port `:5432`)
- `pnpm db:generate` — diff Drizzle schema → new migration file
- `pnpm db:retention` — run conversation/usage retention per org privacy settings

## House style: adding FKs / NOT NULL on large tables

Use PostgreSQL `NOT VALID` so the constraint is catalog-only first (no full-table scan under a long lock), then validate in a separate step:

```sql
ALTER TABLE child
  ADD CONSTRAINT child_parent_id_fk
  FOREIGN KEY (parent_id) REFERENCES parent(id)
  ON DELETE SET NULL NOT VALID;

ALTER TABLE child VALIDATE CONSTRAINT child_parent_id_fk;
```

Always run a one-time orphan cleanup **before** adding the FK.

## Orphan cleanup before FKs

Nullify or delete dangling references, then add constraints. Example pattern:

```sql
UPDATE usage_events SET thread_id = NULL
WHERE thread_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id = usage_events.thread_id);
```

Prefer `ON DELETE SET NULL` for billing/usage history when the referenced thread is removed.

## Retention

`organization_settings.privacy.conversationRetentionDays` drives `pnpm db:retention`, which calls batched purge functions in migration `0032_schema_hardening.sql`. When append-only tables grow large, convert to range partitioning and replace DELETE with `DROP PARTITION`.

## Identity model

- `users` — dashboard accounts (Google OAuth)
- `organization_accounts` — Neylon dashboard account ↔ org link
- `organization_settings` — org timezone + privacy retention
- `organization_participants` — widget visitors + identified end-users, scoped per org (`external_id` + traits from SDK `user` object)
- `threads.participant_id` → `organization_participants.id` (`ON DELETE SET NULL`)
- `threads.organization_id` → `organizations.id` (denormalized tenant scope; required)
- `threads.escalated` — boolean handoff flag (default false)
- `thread_messages` — `role` + `content` only (no agent_id / metadata)
- `thread_escalations` — one row per escalation event (`thread_id`, `reason`, `created_at`); count / last escalated at are derived
- `organization_agents` — Main Agent org state keyed by `agent_key = 'main-agent'`; `extra` jsonb; no `agent_type`; no `agents` catalog table
- `integrations` catalog is code-only (`@neylonai/integrations`); no DB table
- `organization_integrations.integration_id` — catalog string id (no FK)
- `knowledge_sources` — one bag per org integration (`created_at` + `last_synced_at`; no `updated_at`)
- `knowledge_source_agents.agent_key` — code-registry string (no FK)

Lead capture (`leads` table) was removed in `0043_drop_leads`; reintroduce only when product needs it again.
Agent catalog landed in `0044_agents_catalog`; reshape in `0045`; org agent `extra` in `0046`.
Knowledge sources drop `updated_at` in `0047`; source↔agent UUID FK in `0048`; documents drop `storage_key` in `0049`.
Integrations catalog status/extra in `0050`; agents slim `config` in `0051`; drop slug in `0052`.
Integrations catalog dropped in `0053`; agents drop `registryId` in `0054`.
Org-agents only (drop `agents` catalog; `organization_agents.agent_key`; knowledge `agent_key`) in `0055_org_agents_only`.
Main Agent registry key renamed `neylonai-chatbot` → `main-agent` in `0056_main_agent_key`.
Drop `organization_agents.agent_type`; agent keys `support`/`sales`/`technical` → `*-agent` in `0057_org_agents_drop_type_rename_keys`.
AI credits: `usage_request_rollups` + `credit_ledger` + `subscriptions.ai_credits_*` in `0058_ai_credits`. `conversation_turn` stays analytics-only; credits are the entitlement.
Allowance resync in `0059_ai_credit_allowance_resync`; historical quotas Free 5k / Starter 25k / Pro 50k / Business 150k in `0060_ai_credit_quotas`.
Constraints billing cutover in `0067_constraints_billing`: Simple/Standard/Complex at 1/2/5 credits, grants Free 500 / Starter 1,000 / Pro 3,000 / Business 10,000, per-class counters, request reservations, and an immediate full-grant reset.
Billability and paid overage in `0068_billable_overage_policy`: social turns finalize at zero credits and paid plans can reserve provider-invoiced overage after included credits. Current policy treats Simple/Standard quotas as non-blocking planning thresholds and only the Complex quota as a hard request stop.
Current workload enforcement in `0069_current_workload_classes`: normalize stored request/counter data to Simple/Standard/Complex and enforce those three identifiers at the database boundary.
Plan ids in `0071_current_plan_ids`: the internal `platform` plan becomes `business` (it already carried the Business 10,000-credit grant), anything else outside the catalog becomes `free`, grants/balances are resynced to the catalog while preserving period usage, and `subscriptions.plan` is constrained to `free | starter | pro | business`.
Orphan purge in `0070_purge_orphan_org_rows`: delete tenant-scoped rows whose organization no longer exists, restore the missing `organization_id → organizations.id ON DELETE CASCADE` foreign keys on every org-scoped table, and drop integration installs outside the current catalog plus agent rows other than `main-agent`.
Shared wallet in `0072_shared_wallet_1_2_8`: costs become Simple 1 / Standard 2 / Complex 8 with grants Free 500 / Starter 2,000 / Pro 5,000 / Business 15,000. Balances are resynced as `max(0, new_grant − consumed)` so historical ledger charges stay intact; class counters remain analytics/forecast only. Runtime remaps when the shared pool cannot afford the requested class; paid plans with on-demand enabled run the requested class as metered overage at zero included balance.
Website section context in `0078_page_section_suggestions`: stores crawl-extracted page sections and their 1–2 sync-time proactive prompts. Runtime reads these rows; it does not generate section prompts per visitor.
