-- Shared wallet cutover: Simple 1 · Standard 2 · Complex 8
-- Grants: Free 500 · Starter 2,000 · Pro 5,000 · Business 15,000
-- Preserves credits already consumed in the period:
--   used = old_granted − balance
--   new_balance = max(0, new_grant − used)

UPDATE "subscriptions"
SET
  "ai_credits_period_granted" = CASE lower("plan")
    WHEN 'free' THEN 500
    WHEN 'starter' THEN 2000
    WHEN 'pro' THEN 5000
    WHEN 'business' THEN 15000
    ELSE 500
  END,
  "ai_credits_balance" = GREATEST(
    0,
    CASE lower("plan")
      WHEN 'free' THEN 500
      WHEN 'starter' THEN 2000
      WHEN 'pro' THEN 5000
      WHEN 'business' THEN 15000
      ELSE 500
    END
    - GREATEST(0, coalesce("ai_credits_period_granted", 0) - coalesce("ai_credits_balance", 0))
  ),
  "updated_at" = now();
--> statement-breakpoint

-- Cancelled Free customers keep usable Free entitlement (active + free).
UPDATE "subscriptions"
SET
  "status" = 'active',
  "updated_at" = now()
WHERE lower("plan") = 'free'
  AND lower("status") IN ('cancelled', 'canceled');
