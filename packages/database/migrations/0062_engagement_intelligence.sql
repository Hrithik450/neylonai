-- Engagement Intelligence Phase 2: citations, knowledge gaps, proactive trigger telemetry.

CREATE TABLE IF NOT EXISTS "message_citations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "message_id" uuid NOT NULL REFERENCES "thread_messages"("id") ON DELETE CASCADE,
  "chunk_id" uuid NOT NULL REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "source_id" uuid REFERENCES "knowledge_sources"("id") ON DELETE SET NULL,
  "retrieval_score" double precision,
  "rank" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "message_citations_message_chunk_uidx"
  ON "message_citations" ("message_id", "chunk_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_citations_org_created_idx"
  ON "message_citations" ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_citations_message_rank_idx"
  ON "message_citations" ("message_id", "rank");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_gap_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "thread_id" uuid REFERENCES "threads"("id") ON DELETE SET NULL,
  "message_id" uuid REFERENCES "thread_messages"("id") ON DELETE SET NULL,
  "participant_id" uuid REFERENCES "organization_participants"("id") ON DELETE SET NULL,
  "request_id" varchar(64),
  "page_path" text,
  "gap_type" varchar(64) NOT NULL,
  "retrieval_hit_count" integer,
  "sample_question" varchar(500),
  "question_hash" varchar(64) NOT NULL,
  "dedup_key" varchar(128) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "knowledge_gap_events_gap_type_check"
    CHECK ("gap_type" IN (
      'no_retrieval',
      'negative_feedback',
      'unhelpful_escalation',
      'low_confidence_escalation'
    ))
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_gap_events_org_dedup_uidx"
  ON "knowledge_gap_events" ("organization_id", "dedup_key");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_gap_events_org_created_idx"
  ON "knowledge_gap_events" ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_gap_events_org_hash_path_idx"
  ON "knowledge_gap_events" ("organization_id", "question_hash", "page_path");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "proactive_trigger_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "participant_id" uuid REFERENCES "organization_participants"("id") ON DELETE SET NULL,
  "visitor_id" varchar(128),
  "session_id" varchar(128),
  "page_path" text,
  "event_type" varchar(32) NOT NULL,
  "trigger_type" varchar(32),
  "suggestion_id" varchar(64),
  "trigger_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "proactive_trigger_events_event_type_check"
    CHECK ("event_type" IN (
      'scroll_depth',
      'dwell',
      'exit_intent',
      'shown',
      'clicked',
      'dismissed'
    )),
  CONSTRAINT "proactive_trigger_events_trigger_type_check"
    CHECK (
      "trigger_type" IS NULL OR "trigger_type" IN (
        'idle',
        'scroll_depth',
        'dwell',
        'exit_intent'
      )
    )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "proactive_trigger_events_org_created_idx"
  ON "proactive_trigger_events" ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "proactive_trigger_events_org_visitor_page_idx"
  ON "proactive_trigger_events" ("organization_id", "visitor_id", "page_path", "event_type");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_message_citations_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 2000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT mc."id"
      FROM "message_citations" mc
      WHERE mc."organization_id" = p_org_id
        AND mc."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "message_citations" mc
    USING stale
    WHERE mc."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_knowledge_gap_events_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 2000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT kge."id"
      FROM "knowledge_gap_events" kge
      WHERE kge."organization_id" = p_org_id
        AND kge."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "knowledge_gap_events" kge
    USING stale
    WHERE kge."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_proactive_trigger_events_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 2000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT pte."id"
      FROM "proactive_trigger_events" pte
      WHERE pte."organization_id" = p_org_id
        AND pte."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "proactive_trigger_events" pte
    USING stale
    WHERE pte."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
