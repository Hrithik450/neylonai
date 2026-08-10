-- Rename knowledge_sources.integration_type → source_type

ALTER TABLE "knowledge_sources" RENAME COLUMN "integration_type" TO "source_type";

DROP INDEX IF EXISTS "knowledge_sources_org_integration_type_idx";

CREATE INDEX IF NOT EXISTS "knowledge_sources_org_source_type_idx"
  ON "knowledge_sources" ("organization_id", "source_type");
