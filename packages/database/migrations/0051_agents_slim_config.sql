-- Slim agents catalog: fold metadata into config jsonb; drop junction table.

-- 1) Add config column
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "config" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Backfill from legacy columns + required-integrations junction
UPDATE "agents" a
SET "config" = jsonb_strip_nulls(
  jsonb_build_object(
    'description', COALESCE(a."description", ''),
    'role', COALESCE(a."role", 'specialized'),
    'tier', COALESCE(a."tier", 'basic'),
    'defaultActive', COALESCE(a."default_active", false),
    'capabilities', COALESCE(a."capabilities", ''),
    'systemPrompt', a."system_prompt",
    'requiredIntegrationIds', COALESCE((
      SELECT jsonb_agg(ari."integration_id" ORDER BY ari."integration_id")
      FROM "agent_required_integrations" ari
      WHERE ari."agent_id" = a."id"
    ), '[]'::jsonb)
  ) || COALESCE(a."extra", '{}'::jsonb)
);

-- 3) Drop role/tier checks (columns going away)
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_role_values_check";
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_tier_values_check";

-- 4) Drop legacy columns
ALTER TABLE "agents" DROP COLUMN IF EXISTS "description";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "role";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "tier";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "default_active";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "capabilities";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "system_prompt";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "extra";

-- 5) Drop required-integrations junction
DROP TABLE IF EXISTS "agent_required_integrations";
