-- knowledge_documents: drop unused columns; add raw_content + chunks_count;
-- require source_id with ON DELETE CASCADE.
-- knowledge_chunks: drop type + metadata.

-- Documents -----------------------------------------------------------------

ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "status";
ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "integration_id";
ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "document_count";
ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "type";

DROP INDEX IF EXISTS "knowledge_documents_org_type_idx";

ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "raw_content" text;
ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "chunks_count" integer NOT NULL DEFAULT 0;

-- Move scraped / extracted text out of metadata into raw_content.
UPDATE "knowledge_documents"
SET "raw_content" = COALESCE(
  NULLIF(trim("metadata"->>'scrapedText'), ''),
  NULLIF(trim("metadata"->>'extractedText'), ''),
  "raw_content"
)
WHERE "raw_content" IS NULL
  AND (
    ("metadata" ? 'scrapedText')
    OR ("metadata" ? 'extractedText')
  );

UPDATE "knowledge_documents" d
SET "chunks_count" = (
  SELECT count(*)::int FROM "knowledge_chunks" c WHERE c."document_id" = d."id"
);

-- Orphan docs without a source cannot satisfy NOT NULL FK.
DELETE FROM "knowledge_documents" WHERE "source_id" IS NULL;

ALTER TABLE "knowledge_documents"
  DROP CONSTRAINT IF EXISTS "knowledge_documents_source_id_knowledge_sources_id_fk";
ALTER TABLE "knowledge_documents"
  DROP CONSTRAINT IF EXISTS "knowledge_documents_source_id_fkey";
ALTER TABLE "knowledge_documents"
  DROP CONSTRAINT IF EXISTS "knowledge_documents_source_id_fk";

ALTER TABLE "knowledge_documents" ALTER COLUMN "source_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_documents_source_id_fk'
  ) THEN
    ALTER TABLE "knowledge_documents"
      ADD CONSTRAINT "knowledge_documents_source_id_fk"
      FOREIGN KEY ("source_id")
      REFERENCES "knowledge_sources"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

-- Chunks --------------------------------------------------------------------

ALTER TABLE "knowledge_chunks" DROP COLUMN IF EXISTS "type";
ALTER TABLE "knowledge_chunks" DROP COLUMN IF EXISTS "metadata";

DROP INDEX IF EXISTS "knowledge_chunks_org_type_idx";
