-- Remove historical workload identifiers before enforcing the current model.

UPDATE "usage_request_rollups"
SET "complexity_class" = CASE
  WHEN "complexity_class" IN ('low', 'lightweight') THEN 'simple'
  WHEN "complexity_class" IN ('medium', 'knowledge', 'enhanced') THEN 'standard'
  WHEN "complexity_class" IN ('high', 'web_tool', 'extreme') THEN 'complex'
  ELSE 'standard'
END
WHERE "complexity_class" NOT IN ('simple', 'standard', 'complex');
--> statement-breakpoint

INSERT INTO "usage_class_period_counters" (
  "organization_id", "period_start", "workload_class", "used", "reserved", "updated_at"
)
SELECT
  "organization_id",
  "period_start",
  CASE
    WHEN "workload_class" IN ('low', 'lightweight') THEN 'simple'
    WHEN "workload_class" IN ('high', 'web_tool', 'extreme') THEN 'complex'
    ELSE 'standard'
  END,
  sum("used")::integer,
  sum("reserved")::integer,
  now()
FROM "usage_class_period_counters"
WHERE "workload_class" NOT IN ('simple', 'standard', 'complex')
GROUP BY
  "organization_id",
  "period_start",
  CASE
    WHEN "workload_class" IN ('low', 'lightweight') THEN 'simple'
    WHEN "workload_class" IN ('high', 'web_tool', 'extreme') THEN 'complex'
    ELSE 'standard'
  END
ON CONFLICT ("organization_id", "period_start", "workload_class")
DO UPDATE SET
  "used" = "usage_class_period_counters"."used" + excluded."used",
  "reserved" = "usage_class_period_counters"."reserved" + excluded."reserved",
  "updated_at" = now();
--> statement-breakpoint

DELETE FROM "usage_class_period_counters"
WHERE "workload_class" NOT IN ('simple', 'standard', 'complex');
--> statement-breakpoint

UPDATE "usage_request_reservations"
SET "workload_class" = CASE
  WHEN "workload_class" IN ('low', 'lightweight') THEN 'simple'
  WHEN "workload_class" IN ('high', 'web_tool', 'extreme') THEN 'complex'
  ELSE 'standard'
END
WHERE "workload_class" NOT IN ('simple', 'standard', 'complex');
--> statement-breakpoint

ALTER TABLE "usage_request_rollups"
  ADD CONSTRAINT "usage_request_rollups_current_class_check"
  CHECK ("complexity_class" IN ('simple', 'standard', 'complex'));
--> statement-breakpoint

ALTER TABLE "usage_class_period_counters"
  ADD CONSTRAINT "usage_class_period_counters_current_class_check"
  CHECK ("workload_class" IN ('simple', 'standard', 'complex'));
--> statement-breakpoint

ALTER TABLE "usage_request_reservations"
  ADD CONSTRAINT "usage_request_reservations_current_class_check"
  CHECK ("workload_class" IN ('simple', 'standard', 'complex'));
--> statement-breakpoint

UPDATE "widget_configs"
SET "config" = jsonb_set(
  "config",
  '{branding,primaryTextColor}',
  "config" #> '{branding,primaryColor}',
  true
)
WHERE "config" #> '{branding,primaryTextColor}' IS NULL
  AND "config" #> '{branding,primaryColor}' IS NOT NULL;
--> statement-breakpoint

UPDATE "widget_configs"
SET "config" = jsonb_set(
  "config",
  '{branding,gradientFrom}',
  "config" #> '{branding,headerTint}',
  true
)
WHERE "config" #> '{branding,gradientFrom}' IS NULL
  AND "config" #> '{branding,headerTint}' IS NOT NULL;
--> statement-breakpoint

UPDATE "widget_configs"
SET "config" = "config"
  #- '{branding,primaryColor}'
  #- '{branding,headerTint}'
  #- '{branding,socialLinks}'
WHERE "config" #> '{branding,primaryColor}' IS NOT NULL
  OR "config" #> '{branding,headerTint}' IS NOT NULL
  OR "config" #> '{branding,socialLinks}' IS NOT NULL;
--> statement-breakpoint

UPDATE "organization_integrations"
SET
  "config" = "config" - 'connectionUrl',
  "updated_at" = now()
WHERE "config" ? 'connectionUrl';
