-- Minimal escalation event log per thread (reason history).

CREATE TABLE IF NOT EXISTS "thread_escalations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "thread_escalations"
  ADD CONSTRAINT "thread_escalations_thread_id_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "threads"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thread_escalations_thread_id_idx"
  ON "thread_escalations" ("thread_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thread_escalations_thread_id_created_at_idx"
  ON "thread_escalations" ("thread_id", "created_at");
--> statement-breakpoint

-- Seed one reason row for threads already marked escalated (no prior event log).
INSERT INTO "thread_escalations" ("thread_id", "reason", "created_at")
SELECT t."id", 'Escalated before reason history was recorded', t."created_at"
FROM "threads" t
WHERE t."escalated" = true
  AND NOT EXISTS (
    SELECT 1 FROM "thread_escalations" te WHERE te."thread_id" = t."id"
  );
