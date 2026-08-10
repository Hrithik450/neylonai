-- Remove ticket system; conversations are independent for now.

DROP TABLE IF EXISTS "tickets";

ALTER TABLE "conversation_states" DROP COLUMN IF EXISTS "ticket_id";
