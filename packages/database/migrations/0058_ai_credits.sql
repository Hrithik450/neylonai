-- AI credits: request rollups + auditable ledger.
-- conversation_turn remains analytics-only in product_usage_events.

CREATE TABLE IF NOT EXISTS "usage_request_rollups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "request_id" varchar(64) NOT NULL,
  "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE SET NULL,
  "thread_id" uuid REFERENCES "threads"("id") ON DELETE SET NULL,
  "agent_id" varchar(64),
  "complexity_class" varchar(32) NOT NULL,
  "credits_charged" integer NOT NULL DEFAULT 0,
  "routed_model" varchar(120),
  "complexity_tier" varchar(16),
  "route_source" varchar(16),
  "agent_rounds" integer NOT NULL DEFAULT 0,
  "tool_calls" integer NOT NULL DEFAULT 0,
  "tools_used" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "semantic_search_count" integer NOT NULL DEFAULT 0,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "provider_cost_micros" bigint,
  "pricing_status" varchar(16) NOT NULL DEFAULT 'unknown',
  "capped" boolean NOT NULL DEFAULT false,
  "cap_reason" varchar(120),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_request_rollups_org_request_uidx"
  ON "usage_request_rollups" ("organization_id", "request_id");
CREATE INDEX IF NOT EXISTS "usage_request_rollups_org_created_idx"
  ON "usage_request_rollups" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "credit_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "entry_type" varchar(32) NOT NULL,
  "amount" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "reason" varchar(120) NOT NULL,
  "request_id" varchar(64),
  "plan" varchar(64),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_consume_request_uidx"
  ON "credit_ledger" ("organization_id", "request_id")
  WHERE "request_id" IS NOT NULL AND "entry_type" = 'ai_consumption';
CREATE INDEX IF NOT EXISTS "credit_ledger_org_created_idx"
  ON "credit_ledger" ("organization_id", "created_at");

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "ai_credits_balance" integer NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "ai_credits_period_granted" integer NOT NULL DEFAULT 0;

-- One-time backfill: existing orgs get plan AI credits so chat is not blocked
-- after migration. Idempotent via period_granted = 0 guard.
-- Plan map must stay in sync with packages/domain/src/billing/plans.ts.
UPDATE "subscriptions" s
SET
  "ai_credits_balance" = CASE lower(coalesce(s."plan", 'free'))
    WHEN 'starter' THEN 25000
    WHEN 'pro' THEN 50000
    WHEN 'business' THEN 150000
    ELSE 5000
  END,
  "ai_credits_period_granted" = CASE lower(coalesce(s."plan", 'free'))
    WHEN 'starter' THEN 25000
    WHEN 'pro' THEN 50000
    WHEN 'business' THEN 150000
    ELSE 5000
  END,
  "updated_at" = now()
WHERE coalesce(s."ai_credits_period_granted", 0) = 0;

INSERT INTO "credit_ledger" (
  "organization_id",
  "entry_type",
  "amount",
  "balance_after",
  "reason",
  "plan",
  "metadata"
)
SELECT
  s."organization_id",
  'plan_grant',
  s."ai_credits_period_granted",
  s."ai_credits_balance",
  'Legacy migration grant (0058_ai_credits)',
  s."plan",
  jsonb_build_object('legacy', true, 'migration', '0058_ai_credits')
FROM "subscriptions" s
WHERE s."ai_credits_period_granted" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "credit_ledger" cl
    WHERE cl."organization_id" = s."organization_id"
      AND cl."entry_type" = 'plan_grant'
      AND cl."reason" = 'Legacy migration grant (0058_ai_credits)'
  );
