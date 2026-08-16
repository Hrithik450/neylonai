-- Authoritative included AI credit quotas (customer-facing abstract units):
-- Free 5_000 / Starter 25_000 / Pro 50_000 / Business 150_000
-- Not derived from any $/credit conversion. Adjust balance by grant delta.

UPDATE "subscriptions" s
SET
  "ai_credits_balance" = GREATEST(
    0,
    s."ai_credits_balance" + (
      CASE lower(coalesce(s."plan", 'free'))
        WHEN 'starter' THEN 25000
        WHEN 'pro' THEN 50000
        WHEN 'business' THEN 150000
        ELSE 5000
      END - s."ai_credits_period_granted"
    )
  ),
  "ai_credits_period_granted" = CASE lower(coalesce(s."plan", 'free'))
    WHEN 'starter' THEN 25000
    WHEN 'pro' THEN 50000
    WHEN 'business' THEN 150000
    ELSE 5000
  END,
  "updated_at" = now()
WHERE s."ai_credits_period_granted" <> CASE lower(coalesce(s."plan", 'free'))
  WHEN 'starter' THEN 25000
  WHEN 'pro' THEN 50000
  WHEN 'business' THEN 150000
  ELSE 5000
END;
