CREATE TABLE IF NOT EXISTS "knowledge_page_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "section_key" varchar(96) NOT NULL,
  "heading" text NOT NULL,
  "content" text NOT NULL,
  "suggestions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_page_sections_document_key_uidx"
  ON "knowledge_page_sections" ("document_id", "section_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_page_sections_org_document_idx"
  ON "knowledge_page_sections" ("organization_id", "document_id");
