-- Lead Agent settings belong on organization_agents (agent_id = 'lead'), not engagement.
-- Copy existing values into agent rows, then drop the denormalized columns.

INSERT INTO "organization_agents" (
  "id",
  "organization_id",
  "agent_id",
  "enabled",
  "config",
  "updated_at",
  "created_at"
)
SELECT
  gen_random_uuid(),
  e."organization_id",
  'lead',
  COALESCE(e."lead_agent_enabled", true),
  jsonb_build_object(
    'leadAgentEnabled', COALESCE(e."lead_agent_enabled", true),
    'leadFields', COALESCE(e."lead_fields", '["name","email","company"]'::jsonb)
  ),
  NOW(),
  NOW()
FROM "organization_engagement_settings" e
ON CONFLICT ("organization_id", "agent_id") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "config" = COALESCE("organization_agents"."config", '{}'::jsonb) || EXCLUDED."config",
  "updated_at" = NOW();

ALTER TABLE "organization_engagement_settings" DROP COLUMN IF EXISTS "lead_agent_enabled";
ALTER TABLE "organization_engagement_settings" DROP COLUMN IF EXISTS "lead_fields";
