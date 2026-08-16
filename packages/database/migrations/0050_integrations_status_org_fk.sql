-- Enrich integrations catalog (status / extra / updated_at).
-- Rename organization_integrations.integration_type → integration_id with FK.

-- 1) Catalog columns
ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'inactive';
ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "extra" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();

ALTER TABLE "integrations"
  DROP CONSTRAINT IF EXISTS "integrations_status_values_check";
ALTER TABLE "integrations"
  ADD CONSTRAINT "integrations_status_values_check"
  CHECK ("status" IN ('active', 'inactive'));

-- Seed availability to match current connectable manifests
UPDATE "integrations"
SET
  "status" = CASE
    WHEN "id" IN (
      'website',
      'pdf',
      'database',
      'web_search',
      'calcom',
      'calendly',
      'evently'
    ) THEN 'active'
    ELSE 'inactive'
  END,
  "updated_at" = now()
WHERE "status" IS DISTINCT FROM CASE
  WHEN "id" IN (
    'website',
    'pdf',
    'database',
    'web_search',
    'calcom',
    'calendly',
    'evently'
  ) THEN 'active'
  ELSE 'inactive'
END;

-- Ensure every org integration type exists in catalog before FK
INSERT INTO "integrations" ("id", "name", "description", "status")
SELECT DISTINCT
  oi."integration_type",
  oi."integration_type",
  '',
  'inactive'
FROM "organization_integrations" oi
WHERE NOT EXISTS (
  SELECT 1 FROM "integrations" i WHERE i."id" = oi."integration_type"
)
ON CONFLICT ("id") DO NOTHING;

-- 2) Rename org column + FK
DROP INDEX IF EXISTS "organization_integrations_org_integration_type_uidx";
DROP INDEX IF EXISTS "organization_integrations_org_integration_uidx";

ALTER TABLE "organization_integrations"
  RENAME COLUMN "integration_type" TO "integration_id";

CREATE UNIQUE INDEX "organization_integrations_org_integration_uidx"
  ON "organization_integrations" ("organization_id", "integration_id");

ALTER TABLE "organization_integrations"
  DROP CONSTRAINT IF EXISTS "organization_integrations_integration_id_integrations_id_fk";

ALTER TABLE "organization_integrations"
  ADD CONSTRAINT "organization_integrations_integration_id_integrations_id_fk"
  FOREIGN KEY ("integration_id") REFERENCES "integrations"("id")
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE "organization_integrations"
  VALIDATE CONSTRAINT "organization_integrations_integration_id_integrations_id_fk";

-- 3) Keep knowledge_sources.source_type in sync with org integration catalog id
CREATE OR REPLACE FUNCTION sync_knowledge_source_type_from_integration()
RETURNS TRIGGER AS $$
BEGIN
  SELECT oi."integration_id"
  INTO NEW."source_type"
  FROM "organization_integrations" oi
  WHERE oi."id" = NEW."organization_integration_id";

  IF NEW."source_type" IS NULL THEN
    RAISE EXCEPTION 'organization_integration_id % not found', NEW."organization_integration_id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
