-- Knowledge sources (customer-facing) + agent assignment
-- Complements knowledge_documents / chunks; does not replace retrieval tables.

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  knowledge_base_id uuid REFERENCES knowledge_bases(id) ON DELETE SET NULL,
  /** website | document | text | future connector ids */
  type varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  /** processing | active | needs_attention | disabled | failed */
  status varchar(32) NOT NULL DEFAULT 'processing',
  enabled boolean NOT NULL DEFAULT true,
  /** Non-secret: url, text, fileName, connector metadata, workflow hints */
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_count integer NOT NULL DEFAULT 0,
  page_count integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sources_org_idx
  ON knowledge_sources (organization_id);
CREATE INDEX IF NOT EXISTS knowledge_sources_org_status_idx
  ON knowledge_sources (organization_id, status);
CREATE INDEX IF NOT EXISTS knowledge_sources_type_idx
  ON knowledge_sources (organization_id, type);

CREATE TABLE IF NOT EXISTS knowledge_source_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  agent_id varchar(64) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_source_agents_uidx
  ON knowledge_source_agents (organization_id, source_id, agent_id);
CREATE INDEX IF NOT EXISTS knowledge_source_agents_org_idx
  ON knowledge_source_agents (organization_id);
CREATE INDEX IF NOT EXISTS knowledge_source_agents_agent_idx
  ON knowledge_source_agents (organization_id, agent_id);

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES knowledge_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS knowledge_documents_source_id_idx
  ON knowledge_documents (source_id);
