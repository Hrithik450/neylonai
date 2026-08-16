-- Drop unused knowledge_documents display/cache columns.
-- Skip-unchanged still works by hashing raw_content in memory.
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS name CASCADE;
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS content_hash CASCADE;
