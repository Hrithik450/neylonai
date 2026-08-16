-- Store repeated site chrome once while retaining page-specific mappings.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE knowledge_section_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  content_hash varchar(64) NOT NULL,
  heading text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX knowledge_section_contents_source_hash_uidx
  ON knowledge_section_contents (source_id, content_hash);
CREATE INDEX knowledge_section_contents_org_source_idx
  ON knowledge_section_contents (organization_id, source_id);

INSERT INTO knowledge_section_contents (
  organization_id,
  source_id,
  content_hash,
  heading,
  content,
  created_at,
  updated_at
)
SELECT DISTINCT ON (
  d.source_id,
  encode(digest(trim(regexp_replace(s.content, '\s+', ' ', 'g')), 'sha256'), 'hex')
)
  s.organization_id,
  d.source_id,
  encode(digest(trim(regexp_replace(s.content, '\s+', ' ', 'g')), 'sha256'), 'hex'),
  s.heading,
  s.content,
  s.created_at,
  s.updated_at
FROM knowledge_page_sections s
JOIN knowledge_documents d ON d.id = s.document_id
ORDER BY
  d.source_id,
  encode(digest(trim(regexp_replace(s.content, '\s+', ' ', 'g')), 'sha256'), 'hex'),
  s.created_at,
  s.id;

ALTER TABLE knowledge_page_sections
  ADD COLUMN section_content_id uuid;

UPDATE knowledge_page_sections s
SET section_content_id = c.id
FROM knowledge_documents d, knowledge_section_contents c
WHERE d.id = s.document_id
  AND c.source_id = d.source_id
  AND c.content_hash =
    encode(digest(trim(regexp_replace(s.content, '\s+', ' ', 'g')), 'sha256'), 'hex');

ALTER TABLE knowledge_page_sections
  ALTER COLUMN section_content_id SET NOT NULL,
  ADD CONSTRAINT knowledge_page_sections_section_content_id_fkey
    FOREIGN KEY (section_content_id)
    REFERENCES knowledge_section_contents(id)
    ON DELETE CASCADE;

ALTER TABLE knowledge_page_sections DROP COLUMN heading;
ALTER TABLE knowledge_page_sections DROP COLUMN content;
