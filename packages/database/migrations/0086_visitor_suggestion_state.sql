CREATE TABLE IF NOT EXISTS "visitor_suggestion_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "visitor_id" varchar(128) NOT NULL,
  "page_path" varchar(512) NOT NULL,
  "section_key" varchar(96) NOT NULL,
  "shown_suggestion_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pending_suggestion_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "total_suggestions_for_section" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visitor_suggestion_state_uidx"
  ON "visitor_suggestion_state" ("organization_id", "visitor_id", "page_path", "section_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_suggestion_state_org_visitor_idx"
  ON "visitor_suggestion_state" ("organization_id", "visitor_id");
