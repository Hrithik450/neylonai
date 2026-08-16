-- Store only catalog plan ids. The internal `platform` grant was Business
-- entitlements (10,000 credits) under a name the catalog never carried, which
-- made admin surfaces look like Free while balances stayed at 10,000.

UPDATE "subscriptions"
SET "plan" = 'business', "updated_at" = now()
WHERE lower("plan") = 'platform';
--> statement-breakpoint

UPDATE "subscriptions"
SET "plan" = 'free', "updated_at" = now()
WHERE lower("plan") NOT IN ('free', 'starter', 'pro', 'business');
--> statement-breakpoint

UPDATE "credit_ledger"
SET "plan" = 'business'
WHERE lower("plan") = 'platform';
--> statement-breakpoint

-- Keep grant + remaining balance aligned with the catalog after the rename.
-- Preserves credits already consumed in the period: used = old_granted − balance.
UPDATE "subscriptions"
SET
  "ai_credits_period_granted" = CASE lower("plan")
    WHEN 'free' THEN 500
    WHEN 'starter' THEN 1000
    WHEN 'pro' THEN 3000
    WHEN 'business' THEN 10000
    ELSE 500
  END,
  "ai_credits_balance" = GREATEST(
    0,
    CASE lower("plan")
      WHEN 'free' THEN 500
      WHEN 'starter' THEN 1000
      WHEN 'pro' THEN 3000
      WHEN 'business' THEN 10000
      ELSE 500
    END
    - GREATEST(0, coalesce("ai_credits_period_granted", 0) - coalesce("ai_credits_balance", 0))
  ),
  "updated_at" = now();
--> statement-breakpoint

ALTER TABLE "subscriptions"
  DROP CONSTRAINT IF EXISTS "subscriptions_plan_catalog_check";
--> statement-breakpoint

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_plan_catalog_check"
  CHECK ("plan" IN ('free', 'starter', 'pro', 'business'));
