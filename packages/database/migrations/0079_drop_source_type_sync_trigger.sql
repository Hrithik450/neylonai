-- 0075 dropped knowledge_sources.source_type but left the sync trigger that
-- writes NEW.source_type, which breaks every insert into knowledge_sources.
DROP TRIGGER IF EXISTS knowledge_sources_source_type_sync ON knowledge_sources;
DROP FUNCTION IF EXISTS sync_knowledge_source_type_from_integration();
