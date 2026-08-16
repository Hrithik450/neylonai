-- Retention Phase 1: conversation lifecycle, handoff context, answer feedback,
-- per-turn page context, and page-addressable knowledge documents.

ALTER TABLE "threads"
  ADD COLUMN IF NOT EXISTS "conversation_status" varchar(32)
  NOT NULL DEFAULT 'ai_active';
--> statement-breakpoint

UPDATE "threads"
SET "conversation_status" = CASE
  WHEN "escalated" = true THEN 'human_pending'
  ELSE 'ai_active'
END;
--> statement-breakpoint

ALTER TABLE "threads"
  ADD CONSTRAINT "threads_conversation_status_check"
  CHECK ("conversation_status" IN (
    'ai_active',
    'awaiting_contact',
    'human_pending',
    'human_active',
    'resolved'
  ));
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "threads_org_conversation_status_idx"
  ON "threads" ("organization_id", "conversation_status");
--> statement-breakpoint

ALTER TABLE "thread_escalations"
  ADD COLUMN IF NOT EXISTS "trigger" varchar(64),
  ADD COLUMN IF NOT EXISTS "summary" text,
  ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "activated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "thread_escalations"
  ADD CONSTRAINT "thread_escalations_status_check"
  CHECK ("status" IN ('awaiting_contact', 'open', 'resolved'));
--> statement-breakpoint

UPDATE "thread_escalations"
SET "activated_at" = COALESCE("activated_at", "created_at")
WHERE "status" = 'open';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thread_escalations_thread_status_idx"
  ON "thread_escalations" ("thread_id", "status");
--> statement-breakpoint

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "thread_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS row_num
  FROM "thread_escalations"
  WHERE "status" = 'open'
)
UPDATE "thread_escalations" te
SET
  "status" = 'resolved',
  "resolved_at" = COALESCE(te."resolved_at", te."created_at")
FROM ranked
WHERE te."id" = ranked."id"
  AND ranked.row_num > 1;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "thread_escalations_one_active_uidx"
  ON "thread_escalations" ("thread_id")
  WHERE "status" IN ('awaiting_contact', 'open');
--> statement-breakpoint

ALTER TABLE "thread_messages"
  ADD COLUMN IF NOT EXISTS "in_reply_to_message_id" uuid,
  ADD COLUMN IF NOT EXISTS "page_path" text,
  ADD COLUMN IF NOT EXISTS "page_query" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint

ALTER TABLE "thread_messages"
  ADD CONSTRAINT "thread_messages_in_reply_to_fkey"
  FOREIGN KEY ("in_reply_to_message_id")
  REFERENCES "thread_messages"("id")
  ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thread_messages_in_reply_to_idx"
  ON "thread_messages" ("in_reply_to_message_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "message_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "participant_id" uuid NOT NULL,
  "helpful" boolean NOT NULL,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "message_feedback_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE cascade,
  CONSTRAINT "message_feedback_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "thread_messages"("id")
    ON DELETE cascade,
  CONSTRAINT "message_feedback_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "organization_participants"("id")
    ON DELETE cascade
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "message_feedback_message_participant_uidx"
  ON "message_feedback" ("message_id", "participant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_feedback_org_created_idx"
  ON "message_feedback" ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_feedback_org_helpful_idx"
  ON "message_feedback" ("organization_id", "helpful");
--> statement-breakpoint

ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "canonical_url" text,
  ADD COLUMN IF NOT EXISTS "canonical_path" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_documents_source_canonical_path_uidx"
  ON "knowledge_documents" ("source_id", "canonical_path")
  WHERE "canonical_path" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_documents_org_canonical_path_idx"
  ON "knowledge_documents" ("organization_id", "canonical_path");
