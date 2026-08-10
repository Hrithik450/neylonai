-- Enforce one knowledge_source bag per organization_integrations row.
-- Multi-PDF instances live as knowledge_documents under that single source.

-- Merge duplicate sources (keep oldest), reattach documents, then unique.
WITH ranked AS (
  SELECT
    id,
    organization_integration_id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_integration_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM knowledge_sources
),
dupes AS (
  SELECT id, organization_integration_id FROM ranked WHERE rn > 1
),
keepers AS (
  SELECT id, organization_integration_id FROM ranked WHERE rn = 1
)
UPDATE knowledge_documents d
SET source_id = k.id,
    updated_at = now()
FROM dupes du
JOIN keepers k ON k.organization_integration_id = du.organization_integration_id
WHERE d.source_id = du.id;

DELETE FROM knowledge_sources ks
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_integration_id
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM knowledge_sources
  ) ranked
  WHERE ranked.id = ks.id AND ranked.rn > 1
);

-- Refresh document_count after merge.
UPDATE knowledge_sources ks
SET document_count = (
  SELECT count(*)::int FROM knowledge_documents d WHERE d.source_id = ks.id
),
updated_at = now();

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_organization_integration_uidx"
  ON "knowledge_sources" ("organization_integration_id");
