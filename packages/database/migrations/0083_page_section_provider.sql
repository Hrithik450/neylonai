ALTER TABLE "knowledge_page_sections"
  ADD COLUMN "provider" varchar(32) NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
UPDATE "knowledge_page_sections" AS section
SET "provider" = COALESCE((
  SELECT page."provider"
  FROM "website_crawl_pages" AS page
  INNER JOIN "knowledge_documents" AS document
    ON document."id" = section."document_id"
  WHERE page."organization_id" = section."organization_id"
    AND page."canonical_path" = document."canonical_path"
    AND page."provider" IS NOT NULL
  ORDER BY page."updated_at" DESC
  LIMIT 1
), 'unknown');
