-- organization_agents: drop config + updated_at; add extra jsonb.
-- Integrate once — only created_at is retained.

ALTER TABLE "organization_agents"
  ADD COLUMN IF NOT EXISTS "extra" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Preserve any prior config payload into extra when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_agents'
      AND column_name = 'config'
  ) THEN
    UPDATE "organization_agents"
    SET "extra" = COALESCE("config", '{}'::jsonb)
    WHERE "extra" = '{}'::jsonb
      AND "config" IS NOT NULL
      AND "config" <> '{}'::jsonb;

    ALTER TABLE "organization_agents" DROP COLUMN IF EXISTS "config";
  END IF;
END $$;

ALTER TABLE "organization_agents" DROP COLUMN IF EXISTS "updated_at";
