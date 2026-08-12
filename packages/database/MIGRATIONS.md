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

## Legacy tables

`usage_events_legacy` is mapped in Drizzle (`usageEventsLegacy`) so `drizzle-kit generate` does not propose dropping historical COGS rows.

## Retention

`organization_workspace_settings.privacy.conversationRetentionDays` drives `pnpm db:retention`, which calls batched purge functions in migration `0032_schema_hardening.sql`. When append-only tables grow large, convert to range partitioning and replace DELETE with `DROP PARTITION`.

## Identity model

- `users` — dashboard accounts (Google OAuth)
- `visitors` — anonymous widget identities; `threads.visitor_id` references `visitors` with `ON DELETE SET NULL`
