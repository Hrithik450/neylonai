-- Tier 1–3 schema hardening: FKs, visitor split, CHECK constraints, retention infra.
-- House style: NOT VALID + VALIDATE CONSTRAINT for FKs on existing tables.

-- Tier 3: remove unused feedback table
DROP TABLE IF EXISTS "feedback";
--> statement-breakpoint

-- Tier 3: redundant index (organization_id alone is sufficient for lookups)
DROP INDEX IF EXISTS "organization_fonts_org_id_uidx";
--> statement-breakpoint

-- Tier 2: split anonymous widget identities out of dashboard accounts
CREATE TABLE IF NOT EXISTS "visitors" (
  "id" uuid PRIMARY KEY,
  "display_name" varchar(150) NOT NULL DEFAULT 'Guest',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

INSERT INTO "visitors" ("id", "display_name", "created_at", "updated_at")
SELECT
  u."id",
  COALESCE(NULLIF(trim(u."first_name"), ''), 'Guest'),
  u."created_at",
  COALESCE(u."updated_at", u."created_at")
FROM "user" u
WHERE u."role" = 'anonymous'
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "thread" ADD COLUMN IF NOT EXISTS "visitor_id" uuid;
--> statement-breakpoint

UPDATE "thread" t
SET "visitor_id" = t."user_id"
WHERE t."visitor_id" IS NULL
  AND EXISTS (SELECT 1 FROM "visitors" v WHERE v."id" = t."user_id");
--> statement-breakpoint

INSERT INTO "visitors" ("id", "display_name", "created_at", "updated_at")
SELECT
  u."id",
  COALESCE(NULLIF(trim(u."first_name"), ''), 'Guest'),
  u."created_at",
  COALESCE(u."updated_at", u."created_at")
FROM "user" u
INNER JOIN "thread" t ON t."user_id" = u."id"
WHERE t."visitor_id" IS NULL
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

UPDATE "thread" t
SET "visitor_id" = t."user_id"
WHERE t."visitor_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "thread" DROP CONSTRAINT IF EXISTS "thread_user_id_user_id_fk";
--> statement-breakpoint

ALTER TABLE "thread" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint

-- Orphan cleanup before FK enforcement
DELETE FROM "conversation_states" cs
WHERE NOT EXISTS (SELECT 1 FROM "thread" t WHERE t."id" = cs."thread_id");
--> statement-breakpoint

UPDATE "leads"
SET "thread_id" = NULL
WHERE "thread_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "thread" t WHERE t."id" = "leads"."thread_id");
--> statement-breakpoint

UPDATE "usage_events"
SET "thread_id" = NULL
WHERE "thread_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "thread" t WHERE t."id" = "usage_events"."thread_id");
--> statement-breakpoint

UPDATE "product_usage_events"
SET "thread_id" = NULL
WHERE "thread_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "thread" t WHERE t."id" = "product_usage_events"."thread_id");
--> statement-breakpoint

DELETE FROM "leads"
WHERE "organization_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "organizations" o WHERE o."id" = "leads"."organization_id"
  );
--> statement-breakpoint

DELETE FROM "leads" WHERE "organization_id" IS NULL;
--> statement-breakpoint

-- Tier 2: normalize leads closed-vocabulary + NOT NULL defaults
UPDATE "leads" SET "status" = 'new' WHERE "status" IS NULL;
--> statement-breakpoint

UPDATE "leads" SET "crm_sync_status" = 'not_configured' WHERE "crm_sync_status" IS NULL;
--> statement-breakpoint

UPDATE "leads" SET "metadata" = '{}'::jsonb WHERE "metadata" IS NULL;
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "status" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new';
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "crm_sync_status" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "crm_sync_status" SET DEFAULT 'not_configured';
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "metadata" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;
--> statement-breakpoint

-- Collapse spelling drift before CHECK constraints
UPDATE "subscriptions" SET "status" = 'cancelled' WHERE "status" = 'canceled';
--> statement-breakpoint

-- Tier 3: plural table names (batch with visitor migration)
ALTER TABLE "user" RENAME TO "users";
--> statement-breakpoint

ALTER TABLE "thread" RENAME TO "threads";
--> statement-breakpoint

DELETE FROM "users" WHERE "role" = 'anonymous';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "threads_visitor_id_idx" ON "threads" ("visitor_id");
--> statement-breakpoint

ALTER TABLE "threads"
  ADD CONSTRAINT "threads_visitor_id_visitors_id_fk"
  FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "threads" VALIDATE CONSTRAINT "threads_visitor_id_visitors_id_fk";
--> statement-breakpoint

-- Tier 1: missing foreign keys (SET NULL preserves billing/usage history)
ALTER TABLE "conversation_states"
  ADD CONSTRAINT "conversation_states_thread_id_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "conversation_states" VALIDATE CONSTRAINT "conversation_states_thread_id_threads_id_fk";
--> statement-breakpoint

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_thread_id_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "leads" VALIDATE CONSTRAINT "leads_thread_id_threads_id_fk";
--> statement-breakpoint

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "leads" VALIDATE CONSTRAINT "leads_organization_id_organizations_id_fk";
--> statement-breakpoint

ALTER TABLE "usage_events"
  ADD CONSTRAINT "usage_events_thread_id_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "usage_events" VALIDATE CONSTRAINT "usage_events_thread_id_threads_id_fk";
--> statement-breakpoint

ALTER TABLE "product_usage_events"
  ADD CONSTRAINT "product_usage_events_thread_id_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "product_usage_events" VALIDATE CONSTRAINT "product_usage_events_thread_id_threads_id_fk";
--> statement-breakpoint

-- Tier 2: CHECK constraints for closed-vocabulary columns
ALTER TABLE "conversation_states"
  ADD CONSTRAINT "conversation_states_status_check"
  CHECK ("status" IN ('open', 'escalated', 'resolved'));
--> statement-breakpoint

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_status_check"
  CHECK (
    "status" IN (
      'active', 'trialing', 'past_due', 'cancelled', 'expired', 'suspended', 'inactive'
    )
  );
--> statement-breakpoint

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_status_check"
  CHECK ("status" IN ('new', 'contacted', 'qualified', 'synced', 'archived'));
--> statement-breakpoint

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_crm_sync_status_check"
  CHECK (
    "crm_sync_status" IN ('pending', 'synced', 'failed', 'not_configured')
  );
--> statement-breakpoint

ALTER TABLE "usage_events"
  ADD CONSTRAINT "usage_events_pricing_status_check"
  CHECK ("pricing_status" IN ('verified', 'unknown'));
--> statement-breakpoint

-- Tier 2: inbox preview index
CREATE INDEX IF NOT EXISTS "thread_messages_thread_id_created_at_idx"
  ON "thread_messages" ("thread_id", "created_at" DESC);
--> statement-breakpoint

-- Tier 3: widen storage_key for consistency
ALTER TABLE "knowledge_documents" ALTER COLUMN "storage_key" TYPE text;
--> statement-breakpoint

-- Tier 3: keep knowledge_sources.source_type in sync with org integration type
CREATE OR REPLACE FUNCTION sync_knowledge_source_type_from_integration()
RETURNS TRIGGER AS $$
BEGIN
  SELECT oi."integration_type"
  INTO NEW."source_type"
  FROM "organization_integrations" oi
  WHERE oi."id" = NEW."organization_integration_id";

  IF NEW."source_type" IS NULL THEN
    RAISE EXCEPTION 'organization_integration_id % not found', NEW."organization_integration_id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "knowledge_sources_source_type_sync" ON "knowledge_sources";
--> statement-breakpoint

CREATE TRIGGER "knowledge_sources_source_type_sync"
  BEFORE INSERT OR UPDATE OF "organization_integration_id" ON "knowledge_sources"
  FOR EACH ROW EXECUTE FUNCTION sync_knowledge_source_type_from_integration();
--> statement-breakpoint

-- Tier 2: retention audit + purge helpers (partition-ready; expiry via batched DELETE today)
CREATE TABLE IF NOT EXISTS "retention_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "table_name" varchar(64) NOT NULL,
  "rows_deleted" bigint NOT NULL DEFAULT 0,
  "retention_days" integer,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_thread_messages_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 1000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT tm."id"
      FROM "thread_messages" tm
      INNER JOIN "conversation_states" cs ON cs."thread_id" = tm."thread_id"
      WHERE cs."organization_id" = p_org_id
        AND tm."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "thread_messages" tm
    USING stale
    WHERE tm."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_usage_events_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 2000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT ue."id"
      FROM "usage_events" ue
      WHERE ue."organization_id" = p_org_id
        AND ue."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "usage_events" ue
    USING stale
    WHERE ue."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_product_usage_events_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 2000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT pue."id"
      FROM "product_usage_events" pue
      WHERE pue."organization_id" = p_org_id
        AND pue."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "product_usage_events" pue
    USING stale
    WHERE pue."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_billing_events_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 500
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT be."id"
      FROM "billing_events" be
      WHERE be."organization_id" = p_org_id
        AND be."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "billing_events" be
    USING stale
    WHERE be."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
