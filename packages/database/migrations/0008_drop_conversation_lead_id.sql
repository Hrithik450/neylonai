-- Leads are owned solely by the Lead Agent (`leads` table + thread_id).
-- Drop the denormalized pointer from conversation lifecycle state.
ALTER TABLE "conversation_states" DROP COLUMN IF EXISTS "lead_id";
