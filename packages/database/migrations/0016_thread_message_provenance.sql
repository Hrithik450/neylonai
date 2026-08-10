-- Answer provenance + message metadata for dashboard conversations.
-- Public widget APIs must strip provenance before returning messages.

ALTER TABLE thread_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure document → source FK exists (idempotent; may already be present from 0006).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_documents_source_id_fkey'
  ) THEN
    ALTER TABLE knowledge_documents
      ADD CONSTRAINT knowledge_documents_source_id_fkey
      FOREIGN KEY (source_id)
      REFERENCES knowledge_sources(id)
      ON DELETE SET NULL;
  END IF;
END $$;
