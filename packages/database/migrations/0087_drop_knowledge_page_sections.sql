-- Proactive suggestions are generated per page at request time (grounded in the
-- page's crawled content + org knowledge seeds), so per-section rows are no
-- longer read by anything. The only stored values were two hardcoded template
-- questions per section, which the bubble prompt rejects anyway.
--
-- Embedding chunks are unaffected: section sizing happens in memory during
-- ingest and is persisted in knowledge_chunks, not here.
DROP TABLE IF EXISTS "knowledge_page_sections";
