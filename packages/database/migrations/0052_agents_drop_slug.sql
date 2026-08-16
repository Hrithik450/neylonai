-- Move agents.slug into config.registryId, then drop the column.

UPDATE "agents"
SET "config" = COALESCE("config", '{}'::jsonb) || jsonb_build_object('registryId', "slug")
WHERE "slug" IS NOT NULL
  AND (
    "config"->>'registryId' IS NULL
    OR trim("config"->>'registryId') = ''
  );

DROP INDEX IF EXISTS "agents_slug_uidx";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "slug";
