-- Drop platform integrations catalog; code registry is the source of truth.
-- organization_integrations.integration_id remains a catalog string id (no FK).

ALTER TABLE "organization_integrations"
  DROP CONSTRAINT IF EXISTS "organization_integrations_integration_id_integrations_id_fk";

DROP TABLE IF EXISTS "integrations";
