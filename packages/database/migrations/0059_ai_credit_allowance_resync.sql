-- Resync included AI credit grants (superseded by 0060 for current quotas).
-- Free 5000 / Starter 25000 / Pro 50000 / Business 150000

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
