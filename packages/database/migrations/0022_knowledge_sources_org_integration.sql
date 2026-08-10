-- knowledge_sources: drop status/enabled; rename type → integration_type,
-- integration_id → organization_integration_id (still FK to organization_integrations).

ALTER TABLE "knowledge_sources"
  DROP CONSTRAINT IF EXISTS "knowledge_sources_integration_id_fk";

ALTER TABLE "knowledge_sources"
  DROP CONSTRAINT IF EXISTS "knowledge_sources_organization_integration_id_fk";

DROP INDEX IF EXISTS "knowledge_sources_org_type_idx";
DROP INDEX IF EXISTS "knowledge_sources_org_status_idx";
DROP INDEX IF EXISTS "knowledge_sources_org_integration_idx";

ALTER TABLE "knowledge_sources" RENAME COLUMN "integration_id" TO "organization_integration_id";
ALTER TABLE "knowledge_sources" RENAME COLUMN "type" TO "integration_type";

-- Align denormalized catalog name with the org integration row.
UPDATE "knowledge_sources" ks
SET "integration_type" = oi."integration_type"
FROM "organization_integrations" oi
WHERE ks."organization_integration_id" = oi."id";

ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "status";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "enabled";

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_integration_type_idx"
  ON "knowledge_sources" ("organization_id", "integration_type");

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_organization_integration_idx"
  ON "knowledge_sources" ("organization_id", "organization_integration_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_sources_organization_integration_id_fk'
  ) THEN
    ALTER TABLE "knowledge_sources"
      ADD CONSTRAINT "knowledge_sources_organization_integration_id_fk"
      FOREIGN KEY ("organization_integration_id")
      REFERENCES "organization_integrations"("id")
      ON DELETE CASCADE;
  END IF;
END $$;
