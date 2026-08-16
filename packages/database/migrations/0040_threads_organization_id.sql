-- Denormalize tenant ownership onto threads for direct org-scoped queries.

ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
--> statement-breakpoint

UPDATE "threads" t
SET "organization_id" = op."organization_id"
FROM "organization_participants" op
WHERE t."participant_id" = op."id"
  AND t."organization_id" IS NULL;
--> statement-breakpoint

-- Orphan threads (no participant / no org) cannot be tenant-scoped — drop them.
DELETE FROM "threads"
WHERE "organization_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "threads" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "threads"
  ADD CONSTRAINT "threads_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE cascade ON UPDATE no action
  NOT VALID;
--> statement-breakpoint

ALTER TABLE "threads" VALIDATE CONSTRAINT "threads_organization_id_organizations_id_fk";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "threads_organization_id_idx"
  ON "threads" ("organization_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "threads_org_created_at_idx"
  ON "threads" ("organization_id", "created_at");
--> statement-breakpoint

-- Retention purge can filter threads by organization_id directly.
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
      WHERE th."organization_id" = p_org_id
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
