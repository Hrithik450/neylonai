-- Drop knowledge_bases; connector-scope synced knowledge via integration_id.
-- Hierarchy: organization → knowledge_sources → knowledge_documents → knowledge_chunks

ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "integration_id" varchar(64);
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "integration_id" varchar(64);
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "integration_id" varchar(64);

-- Backfill sources from config.integrationId or type mapping
UPDATE "knowledge_sources"
SET "integration_id" = COALESCE(
  NULLIF(trim(config->>'integrationId'), ''),
  CASE
    WHEN "type" = 'website' THEN 'website'
    WHEN "type" = 'document' THEN 'pdf'
    ELSE 'legacy'
  END
)
WHERE "integration_id" IS NULL OR trim("integration_id") = '';

-- Documents from linked source, else legacy
UPDATE "knowledge_documents" d
SET "integration_id" = COALESCE(
  (
    SELECT s."integration_id"
    FROM "knowledge_sources" s
    WHERE s."id" = d."source_id"
  ),
  'legacy'
)
WHERE d."integration_id" IS NULL OR trim(d."integration_id") = '';

-- Chunks from parent document
UPDATE "knowledge_chunks" c
SET "integration_id" = COALESCE(
  (
    SELECT d."integration_id"
    FROM "knowledge_documents" d
    WHERE d."id" = c."document_id"
  ),
  'legacy'
)
WHERE c."integration_id" IS NULL OR trim(c."integration_id") = '';

ALTER TABLE "knowledge_sources" ALTER COLUMN "integration_id" SET NOT NULL;
ALTER TABLE "knowledge_documents" ALTER COLUMN "integration_id" SET NOT NULL;
ALTER TABLE "knowledge_chunks" ALTER COLUMN "integration_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_integration_idx"
  ON "knowledge_sources" ("organization_id", "integration_id");
CREATE INDEX IF NOT EXISTS "knowledge_documents_org_integration_idx"
  ON "knowledge_documents" ("organization_id", "integration_id");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_org_integration_idx"
  ON "knowledge_chunks" ("organization_id", "integration_id");

-- Replace unique indexes keyed by knowledge_base_id
DROP INDEX IF EXISTS "knowledge_documents_kb_external_uidx";
DROP INDEX IF EXISTS "knowledge_chunks_kb_external_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_documents_org_external_uidx"
  ON "knowledge_documents" ("organization_id", "external_doc_id");
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_org_external_uidx"
  ON "knowledge_chunks" ("organization_id", "external_chunk_id");

-- Drop knowledge_base_id FKs / indexes / columns
ALTER TABLE "knowledge_sources" DROP CONSTRAINT IF EXISTS "knowledge_sources_knowledge_base_id_knowledge_bases_id_fk";
ALTER TABLE "knowledge_documents" DROP CONSTRAINT IF EXISTS "knowledge_documents_knowledge_base_id_knowledge_bases_id_fk";
ALTER TABLE "knowledge_chunks" DROP CONSTRAINT IF EXISTS "knowledge_chunks_knowledge_base_id_knowledge_bases_id_fk";

DROP INDEX IF EXISTS "knowledge_documents_knowledge_base_id_idx";
DROP INDEX IF EXISTS "knowledge_chunks_knowledge_base_id_idx";

ALTER TABLE "knowledge_sources" DROP COLUMN IF EXISTS "knowledge_base_id";
ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "knowledge_base_id";
ALTER TABLE "knowledge_chunks" DROP COLUMN IF EXISTS "knowledge_base_id";

DROP TABLE IF EXISTS "knowledge_bases";
