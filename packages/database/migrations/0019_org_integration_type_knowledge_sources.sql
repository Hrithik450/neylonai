-- organization_integrations: catalog key is `type` (website, pdf, …);
-- user credentials / URLs live in `config`.
-- knowledge_sources: `type` = catalog name; `integration_id` = FK to organization_integrations.id.
-- Drop kind + website_url from sources (URL/credentials belong on the org integration row).
-- knowledge_documents / knowledge_chunks: rename catalog column integration_id → type.

ALTER TABLE "organization_integrations" RENAME COLUMN "integration_id" TO "type";
--> statement-breakpoint

DROP INDEX IF EXISTS "organization_integrations_org_int_uidx";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_integrations_org_type_uidx"
  ON "organization_integrations" ("organization_id", "type");
--> statement-breakpoint

ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "type" varchar(64);
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_sources_organization_integration_id_fk'
  ) THEN
    ALTER TABLE "knowledge_sources"
      DROP CONSTRAINT "knowledge_sources_organization_integration_id_fk";
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sources'
      AND column_name = 'organization_integration_id'
  ) THEN
    ALTER TABLE "knowledge_sources"
      RENAME COLUMN "organization_integration_id" TO "integration_id";
  END IF;
END $$;
--> statement-breakpoint

-- Backfill type from legacy kind / linked org integration
UPDATE "knowledge_sources"
SET "type" = 'website'
WHERE ("type" IS NULL OR "type" = '')
  AND "kind" = 'website';
--> statement-breakpoint

UPDATE "knowledge_sources" ks
SET "type" = oi."type"
FROM "organization_integrations" oi
WHERE ks."integration_id" = oi."id"
  AND (ks."type" IS NULL OR ks."type" = '');
--> statement-breakpoint

-- Link orphan website sources to (or create) organization_integrations + move URL into config
DO $$
DECLARE
  r RECORD;
  oi_id uuid;
  cfg jsonb;
BEGIN
  FOR r IN
    SELECT * FROM knowledge_sources
    WHERE kind = 'website' AND integration_id IS NULL
  LOOP
    SELECT id, config INTO oi_id, cfg
    FROM organization_integrations
    WHERE organization_id = r.organization_id AND type = 'website'
    LIMIT 1;

    IF oi_id IS NULL THEN
      INSERT INTO organization_integrations (
        organization_id, type, enabled, status, config
      ) VALUES (
        r.organization_id,
        'website',
        true,
        'connected',
        CASE
          WHEN r.website_url IS NOT NULL AND r.website_url <> ''
            THEN jsonb_build_object('url', r.website_url)
          ELSE '{}'::jsonb
        END
      )
      RETURNING id INTO oi_id;
    ELSIF r.website_url IS NOT NULL AND r.website_url <> '' THEN
      UPDATE organization_integrations
      SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('url', r.website_url),
          updated_at = now()
      WHERE id = oi_id;
    END IF;

    UPDATE knowledge_sources
    SET integration_id = oi_id, type = 'website'
    WHERE id = r.id;
  END LOOP;
END $$;
--> statement-breakpoint

-- Move remaining website_url values onto linked org integration config
UPDATE "organization_integrations" oi
SET "config" = COALESCE(oi."config", '{}'::jsonb) || jsonb_build_object('url', ks."website_url"),
    "updated_at" = now()
FROM "knowledge_sources" ks
WHERE ks."integration_id" = oi."id"
  AND ks."website_url" IS NOT NULL
  AND ks."website_url" <> ''
  AND (oi."config"->>'url' IS NULL OR oi."config"->>'url' = '');
--> statement-breakpoint

-- Drop sources that still cannot be linked (should be rare)
DELETE FROM "knowledge_sources"
WHERE "integration_id" IS NULL OR "type" IS NULL OR "type" = '';
--> statement-breakpoint

ALTER TABLE "knowledge_sources" ALTER COLUMN "type" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "knowledge_sources" ALTER COLUMN "integration_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "kind";
--> statement-breakpoint

ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "website_url";
--> statement-breakpoint

DROP INDEX IF EXISTS "knowledge_sources_org_kind_idx";
--> statement-breakpoint

DROP INDEX IF EXISTS "knowledge_sources_org_integration_row_idx";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_type_idx"
  ON "knowledge_sources" ("organization_id", "type");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_integration_idx"
  ON "knowledge_sources" ("organization_id", "integration_id");
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_sources_integration_id_fk'
  ) THEN
    ALTER TABLE "knowledge_sources"
      ADD CONSTRAINT "knowledge_sources_integration_id_fk"
      FOREIGN KEY ("integration_id")
      REFERENCES "organization_integrations"("id")
      ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint

-- Documents / chunks: catalog key renamed to type
ALTER TABLE "knowledge_documents" RENAME COLUMN "integration_id" TO "type";
--> statement-breakpoint

ALTER TABLE "knowledge_chunks" RENAME COLUMN "integration_id" TO "type";
--> statement-breakpoint

DROP INDEX IF EXISTS "knowledge_documents_org_integration_idx";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_documents_org_type_idx"
  ON "knowledge_documents" ("organization_id", "type");
--> statement-breakpoint

DROP INDEX IF EXISTS "knowledge_chunks_org_integration_idx";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_chunks_org_type_idx"
  ON "knowledge_chunks" ("organization_id", "type");
