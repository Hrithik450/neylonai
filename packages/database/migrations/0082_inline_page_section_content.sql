ALTER TABLE "knowledge_page_sections"
  ADD COLUMN "heading" text,
  ADD COLUMN "content" text;
--> statement-breakpoint
UPDATE "knowledge_page_sections" AS page_section
SET
  "heading" = section_content."heading",
  "content" = section_content."content"
FROM "knowledge_section_contents" AS section_content
WHERE page_section."section_content_id" = section_content."id";
--> statement-breakpoint
ALTER TABLE "knowledge_page_sections"
  ALTER COLUMN "heading" SET NOT NULL,
  ALTER COLUMN "content" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "knowledge_page_sections"
  DROP COLUMN "section_content_id";
--> statement-breakpoint
DROP TABLE "knowledge_section_contents";
