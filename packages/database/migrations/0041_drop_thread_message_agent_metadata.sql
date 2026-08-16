-- Drop thread_messages agent/provenance columns (content + role only for MVP).

DROP INDEX IF EXISTS "thread_messages_agent_id_idx";
--> statement-breakpoint

ALTER TABLE "thread_messages" DROP COLUMN IF EXISTS "agent_id";
--> statement-breakpoint

ALTER TABLE "thread_messages" DROP COLUMN IF EXISTS "metadata";
