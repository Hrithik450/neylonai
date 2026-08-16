-- Drop tables that are only used for retention cleanup (no business logic reads)

DROP TABLE IF EXISTS knowledge_gap_events CASCADE;
DROP TABLE IF EXISTS proactive_trigger_events CASCADE;
DROP TABLE IF EXISTS message_citations CASCADE;
