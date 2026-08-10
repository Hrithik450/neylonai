-- Drop organization_integrations.status — enabled alone is enough.
-- (integration_id already renamed to type in 0019.)

ALTER TABLE "organization_integrations" DROP COLUMN IF EXISTS "status";
