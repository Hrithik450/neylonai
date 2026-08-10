-- Rename organization_integrations.type → integration_type

ALTER TABLE "organization_integrations" RENAME COLUMN "type" TO "integration_type";

DROP INDEX IF EXISTS "organization_integrations_org_type_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "organization_integrations_org_integration_type_uidx"
  ON "organization_integrations" ("organization_id", "integration_type");
