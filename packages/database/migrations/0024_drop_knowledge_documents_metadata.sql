-- Drop knowledge_documents.metadata; keep PDF object key as storage_key.

ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "storage_key" varchar(512);

UPDATE "knowledge_documents"
SET "storage_key" = NULLIF(trim("metadata"->>'storageKey'), '')
WHERE "storage_key" IS NULL
  AND "metadata" ? 'storageKey';

ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "metadata";
