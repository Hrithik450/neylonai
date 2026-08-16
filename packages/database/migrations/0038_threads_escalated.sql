-- Minimal human handoff: threads.escalated only. Drop conversation_states + engagement settings.

ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "escalated" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "threads_escalated_idx" ON "threads" ("escalated") WHERE "escalated" = true;
--> statement-breakpoint

-- Preserve escalated conversations from conversation_states
UPDATE "threads" t
SET "escalated" = true
FROM "conversation_states" cs
WHERE cs."thread_id" = t."id"
  AND cs."status" = 'escalated';
--> statement-breakpoint

-- Retention purge: join via organization_participants instead of conversation_states
CREATE OR REPLACE FUNCTION purge_thread_messages_for_org(
  p_org_id uuid,
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 1000
) RETURNS bigint AS $$
DECLARE
  total bigint := 0;
  batch bigint;
BEGIN
  LOOP
    WITH stale AS (
      SELECT tm."id"
      FROM "thread_messages" tm
      INNER JOIN "threads" th ON th."id" = tm."thread_id"
      INNER JOIN "organization_participants" op ON op."id" = th."participant_id"
      WHERE op."organization_id" = p_org_id
        AND tm."created_at" < p_cutoff
      LIMIT p_batch_size
    )
    DELETE FROM "thread_messages" tm
    USING stale
    WHERE tm."id" = stale."id";

    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TABLE IF EXISTS "conversation_states";
--> statement-breakpoint

DROP TABLE IF EXISTS "organization_engagement_settings";
