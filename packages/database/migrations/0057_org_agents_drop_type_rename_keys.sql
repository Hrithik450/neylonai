-- Drop agent_type; normalize agent_key to *-agent pattern.

UPDATE "organization_agents"
SET "agent_key" = CASE "agent_key"
  WHEN 'neylonai-chatbot' THEN 'main-agent'
  WHEN 'support' THEN 'support-agent'
  WHEN 'sales' THEN 'sales-agent'
  WHEN 'technical' THEN 'technical-agent'
  ELSE "agent_key"
END
WHERE "agent_key" IN ('neylonai-chatbot', 'support', 'sales', 'technical');

UPDATE "knowledge_source_agents"
SET "agent_key" = CASE "agent_key"
  WHEN 'neylonai-chatbot' THEN 'main-agent'
  WHEN 'support' THEN 'support-agent'
  WHEN 'sales' THEN 'sales-agent'
  WHEN 'technical' THEN 'technical-agent'
  ELSE "agent_key"
END
WHERE "agent_key" IN ('neylonai-chatbot', 'support', 'sales', 'technical');

-- Deduplicate after rename (keep earliest)
DELETE FROM "organization_agents" oa
WHERE oa."id" IN (
  SELECT id FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "organization_id", "agent_key"
        ORDER BY "created_at" ASC NULLS LAST, "id" ASC
      ) AS rn
    FROM "organization_agents"
  ) d
  WHERE d.rn > 1
);

DELETE FROM "knowledge_source_agents" ksa
WHERE ksa."id" IN (
  SELECT id FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "organization_id", "source_id", "agent_key"
        ORDER BY "created_at" ASC NULLS LAST, "id" ASC
      ) AS rn
    FROM "knowledge_source_agents"
  ) d
  WHERE d.rn > 1
);

ALTER TABLE "organization_agents"
  DROP CONSTRAINT IF EXISTS "organization_agents_agent_type_check";
ALTER TABLE "organization_agents" DROP COLUMN IF EXISTS "agent_type";
