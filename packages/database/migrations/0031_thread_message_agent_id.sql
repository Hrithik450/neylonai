ALTER TABLE "thread_messages" ADD COLUMN IF NOT EXISTS "agent_id" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_messages_agent_id_idx" ON "thread_messages" ("agent_id");
