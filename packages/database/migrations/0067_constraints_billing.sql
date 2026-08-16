-- Constraints billing cutover: 1/2/5 workloads, smaller grants, hard class caps.

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "ai_credits_reserved" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "credits_period_start" timestamptz;
--> statement-breakpoint

ALTER TABLE "credit_ledger"
  ADD COLUMN IF NOT EXISTS "period_key" varchar(64);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "usage_class_period_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "period_start" timestamptz NOT NULL,
  "workload_class" varchar(32) NOT NULL,
  "used" integer NOT NULL DEFAULT 0,
  "reserved" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "usage_class_period_counters_org_period_class_uidx"
  ON "usage_class_period_counters" ("organization_id", "period_start", "workload_class");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "usage_request_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "request_id" varchar(64) NOT NULL,
  "workload_class" varchar(32) NOT NULL,
  "credits" integer NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'reserved',
  "period_start" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "usage_request_reservations_org_request_uidx"
  ON "usage_request_reservations" ("organization_id", "request_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "usage_request_reservations_org_status_idx"
  ON "usage_request_reservations" ("organization_id", "status");
--> statement-breakpoint

DROP INDEX IF EXISTS "credit_ledger_consume_request_uidx";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_consume_request_uidx"
  ON "credit_ledger" ("organization_id", "request_id")
  WHERE "request_id" IS NOT NULL AND "entry_type" IN ('ai_consumption', 'ai_on_demand');
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_plan_grant_period_uidx"
  ON "credit_ledger" ("organization_id", "period_key")
  WHERE "entry_type" = 'plan_grant' AND "period_key" IS NOT NULL;
--> statement-breakpoint

DELETE FROM "billing_events" a
USING "billing_events" b
WHERE a.external_id IS NOT NULL
  AND a.external_id = b.external_id
  AND a.provider = b.provider
  AND a.ctid < b.ctid;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "billing_events_provider_external_uidx"
  ON "billing_events" ("provider", "external_id")
  WHERE "external_id" IS NOT NULL;
--> statement-breakpoint

-- Immediate reset: full new grant, zero reserved, zero class counters.
UPDATE "subscriptions"
SET
  "ai_credits_period_granted" = CASE lower("plan")
    WHEN 'starter' THEN 1000
    WHEN 'pro' THEN 3000
    WHEN 'business' THEN 10000
    WHEN 'platform' THEN 10000
    ELSE 500
  END,
  "ai_credits_balance" = CASE lower("plan")
    WHEN 'starter' THEN 1000
    WHEN 'pro' THEN 3000
    WHEN 'business' THEN 10000
    WHEN 'platform' THEN 10000
    ELSE 500
  END,
  "ai_credits_reserved" = 0,
  "credits_period_start" = COALESCE("current_period_start", now()),
  "updated_at" = now();
--> statement-breakpoint

INSERT INTO "credit_ledger" (
  "organization_id",
  "entry_type",
  "amount",
  "balance_after",
  "reason",
  "plan",
  "period_key",
  "metadata"
)
SELECT
  s."organization_id",
  'plan_grant',
  s."ai_credits_period_granted",
  s."ai_credits_balance",
  'Constraints cutover reset',
  s."plan",
  to_char(COALESCE(s."credits_period_start", now()) AT TIME ZONE 'utc', 'YYYY-MM-DD')
    || ':' || lower(s."plan"),
  jsonb_build_object('cutover', true, 'previousGranted', 0)
FROM "subscriptions" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "credit_ledger" c
  WHERE c."organization_id" = s."organization_id"
    AND c."entry_type" = 'plan_grant'
    AND c."period_key" = to_char(
      COALESCE(s."credits_period_start", now()) AT TIME ZONE 'utc',
      'YYYY-MM-DD'
    ) || ':' || lower(s."plan")
);
