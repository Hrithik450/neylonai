-- Drop unused columns across various tables

-- thread_escalations: only 'reason' is used in business logic
ALTER TABLE thread_escalations DROP COLUMN IF EXISTS trigger CASCADE;
ALTER TABLE thread_escalations DROP COLUMN IF EXISTS summary CASCADE;

-- organization_integration_secrets: redundant organization_id (already have via FK)
ALTER TABLE organization_integration_secrets DROP COLUMN IF EXISTS organization_id CASCADE;

-- knowledge_sources: source_type is denormalized, document_count is cached
ALTER TABLE knowledge_sources DROP COLUMN IF EXISTS source_type CASCADE;
ALTER TABLE knowledge_sources DROP COLUMN IF EXISTS document_count CASCADE;

-- knowledge_documents: chunks_count is cached, sitemap_lastmod/canonical_url unused
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS chunks_count CASCADE;
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS sitemap_lastmod CASCADE;
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS canonical_url CASCADE;

-- organization_participants: last_seen_at and traits unused
ALTER TABLE organization_participants DROP COLUMN IF EXISTS last_seen_at CASCADE;
ALTER TABLE organization_participants DROP COLUMN IF EXISTS traits CASCADE;

-- thread_messages: page_query unused (page_path is sufficient)
ALTER TABLE thread_messages DROP COLUMN IF EXISTS page_query CASCADE;

-- subscriptions: credit reservation tracking moved to separate table
ALTER TABLE subscriptions DROP COLUMN IF EXISTS ai_credits_reserved CASCADE;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS ai_credits_period_granted CASCADE;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS credits_period_start CASCADE;

-- api_keys: allowed_origins unused (CORS handled at app level)
ALTER TABLE api_keys DROP COLUMN IF EXISTS allowed_origins CASCADE;

-- usage_events: metadata unused (specific fields used instead)
ALTER TABLE usage_events DROP COLUMN IF EXISTS metadata CASCADE;

-- product_usage_events: metadata unused
ALTER TABLE product_usage_events DROP COLUMN IF EXISTS metadata CASCADE;

-- usage_request_rollups: metadata unused
ALTER TABLE usage_request_rollups DROP COLUMN IF EXISTS metadata CASCADE;

-- credit_ledger: metadata unused
ALTER TABLE credit_ledger DROP COLUMN IF EXISTS metadata CASCADE;

-- website_crawl_jobs: categories unused
ALTER TABLE website_crawl_jobs DROP COLUMN IF EXISTS categories CASCADE;

-- website_crawl_pages: error_code unused (error text is sufficient)
ALTER TABLE website_crawl_pages DROP COLUMN IF EXISTS error_code CASCADE;

-- proactive_trigger_events metadata: unused
-- (table already dropped in 0074)
