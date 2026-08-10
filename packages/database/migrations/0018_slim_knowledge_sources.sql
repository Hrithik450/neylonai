-- Slim knowledge_sources: website URL OR organization_integrations FK + document_count.
-- Drop type/name/config/integration_id/content_count/page_count/last_error.

ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "kind" varchar(32);
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "website_url" text;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "organization_integration_id" uuid;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "document_count" integer NOT NULL DEFAULT 0;

-- Backfill kind + website_url / org integration link from legacy columns
UPDATE "knowledge_sources" ks
SET
  "kind" = CASE
    WHEN COALESCE(ks."type", '') = 'website'
      OR COALESCE(ks."integration_id", '') = 'website'
      OR NULLIF(trim(ks.config->>'url'), '') IS NOT NULL
      THEN 'website'
    ELSE 'integration'
  END,
  "website_url" = COALESCE(
    NULLIF(trim(ks.config->>'url'), ''),
    CASE WHEN COALESCE(ks."type", '') = 'website' THEN NULLIF(trim(ks."name"), '') ELSE NULL END
  ),
  "organization_integration_id" = CASE
    WHEN COALESCE(ks."type", '') = 'website'
      OR COALESCE(ks."integration_id", '') = 'website'
      OR NULLIF(trim(ks.config->>'url'), '') IS NOT NULL
      THEN NULL
    ELSE (
      SELECT oi.id
      FROM organization_integrations oi
      WHERE oi.organization_id = ks.organization_id
        AND oi.integration_id = COALESCE(
          NULLIF(trim(ks."integration_id"), ''),
          NULLIF(trim(ks.config->>'integrationId'), ''),
          CASE WHEN ks."type" = 'document' THEN 'pdf' ELSE 'legacy' END
        )
      LIMIT 1
    )
  END
WHERE ks."kind" IS NULL;

-- Ensure website org_integration exists and link when possible is skipped for kind=website
-- Drop orphaned "integration" sources that could not resolve an org_integrations row:
-- keep them as kind=integration with null FK only if we can create a stub later; for now leave null.

-- Move useful config onto linked documents' metadata
UPDATE knowledge_documents d
SET metadata = COALESCE(d.metadata, '{}'::jsonb) || COALESCE(
  (
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'scrapedText', s.config->'scrapedText',
      'extractedText', s.config->'extractedText',
      'storageKey', s.config->'storageKey',
      'publicUrl', s.config->'publicUrl',
      'fileName', s.config->'fileName',
      'contentType', s.config->'contentType',
      'byteSize', s.config->'byteSize',
      'url', s.config->'url',
      'visibility', s.config->'visibility'
    ))
    FROM knowledge_sources s
    WHERE s.id = d.source_id
  ),
  '{}'::jsonb
)
WHERE d.source_id IS NOT NULL;

-- Refresh document_count from actual children
UPDATE knowledge_sources ks
SET document_count = (
  SELECT count(*)::int FROM knowledge_documents d WHERE d.source_id = ks.id
);

ALTER TABLE "knowledge_sources" ALTER COLUMN "kind" SET NOT NULL;

-- Drop legacy columns / indexes
DROP INDEX IF EXISTS "knowledge_sources_type_idx";
DROP INDEX IF EXISTS "knowledge_sources_org_integration_idx";

ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "integration_id";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "type";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "name";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "config";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "content_count";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "page_count";
ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "last_error";

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_kind_idx"
  ON "knowledge_sources" ("organization_id", "kind");
CREATE INDEX IF NOT EXISTS "knowledge_sources_org_integration_row_idx"
  ON "knowledge_sources" ("organization_id", "organization_integration_id");

ALTER TABLE "knowledge_sources"
  DROP CONSTRAINT IF EXISTS "knowledge_sources_organization_integration_id_fk";
ALTER TABLE "knowledge_sources"
  ADD CONSTRAINT "knowledge_sources_organization_integration_id_fk"
  FOREIGN KEY ("organization_integration_id")
  REFERENCES "organization_integrations"("id")
  ON DELETE cascade;

-- Soft check: website rows should have a URL; integration rows should prefer a FK
-- (not enforced strictly to allow migration leftovers)
