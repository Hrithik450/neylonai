-- Drop agents catalog. organization_agents keyed by code-registry agent_key.
-- knowledge_source_agents.agent_id (uuid) → agent_key (varchar).

-- 1) organization_agents: add agent_key + agent_type
ALTER TABLE "organization_agents"
  ADD COLUMN IF NOT EXISTS "agent_key" varchar(64);
ALTER TABLE "organization_agents"
  ADD COLUMN IF NOT EXISTS "agent_type" varchar(16);

-- Backfill from agents catalog when present
UPDATE "organization_agents" oa
SET
  "agent_key" = CASE
    WHEN a."config"->>'role' = 'main' THEN 'main-agent'
    WHEN lower(a."name") LIKE '%support%' AND lower(a."name") LIKE '%technical%' THEN 'technical-agent'
    WHEN lower(a."name") LIKE '%support%' THEN 'support-agent'
    WHEN lower(a."name") LIKE '%sales%' THEN 'sales-agent'
    WHEN lower(a."name") LIKE '%technical%' THEN 'technical-agent'
    ELSE NULL
  END,
  "agent_type" = CASE
    WHEN a."config"->>'role' = 'main' THEN 'main'
    ELSE 'specialized'
  END
FROM "agents" a
WHERE oa."agent_id" = a."id"
  AND oa."agent_key" IS NULL;

-- Drop rows we could not map
DELETE FROM "organization_agents" WHERE "agent_key" IS NULL;

-- Deduplicate (org, agent_key) keeping earliest created_at
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

ALTER TABLE "organization_agents" ALTER COLUMN "agent_key" SET NOT NULL;
ALTER TABLE "organization_agents" ALTER COLUMN "agent_type" SET NOT NULL;

ALTER TABLE "organization_agents"
  DROP CONSTRAINT IF EXISTS "organization_agents_agent_type_check";
ALTER TABLE "organization_agents"
  ADD CONSTRAINT "organization_agents_agent_type_check"
  CHECK ("agent_type" IN ('main', 'specialized'));

DROP INDEX IF EXISTS "organization_agents_org_agent_uidx";

ALTER TABLE "organization_agents"
  DROP CONSTRAINT IF EXISTS "organization_agents_agent_id_agents_id_fk";
ALTER TABLE "organization_agents" DROP COLUMN IF EXISTS "agent_id";

CREATE UNIQUE INDEX "organization_agents_org_agent_key_uidx"
  ON "organization_agents" ("organization_id", "agent_key");

-- 2) knowledge_source_agents: remap to agent_key
ALTER TABLE "knowledge_source_agents"
  ADD COLUMN IF NOT EXISTS "agent_key" varchar(64);

UPDATE "knowledge_source_agents" ksa
SET "agent_key" = CASE
  WHEN a."config"->>'role' = 'main' THEN 'main-agent'
  WHEN lower(a."name") LIKE '%support%' AND lower(a."name") LIKE '%technical%' THEN 'technical-agent'
  WHEN lower(a."name") LIKE '%support%' THEN 'support-agent'
  WHEN lower(a."name") LIKE '%sales%' THEN 'sales-agent'
  WHEN lower(a."name") LIKE '%technical%' THEN 'technical-agent'
  ELSE 'main-agent'
END
FROM "agents" a
WHERE ksa."agent_id" = a."id"
  AND ksa."agent_key" IS NULL;

UPDATE "knowledge_source_agents"
SET "agent_key" = 'main-agent'
WHERE "agent_key" IS NULL;

ALTER TABLE "knowledge_source_agents" ALTER COLUMN "agent_key" SET NOT NULL;

DROP INDEX IF EXISTS "knowledge_source_agents_uidx";
DROP INDEX IF EXISTS "knowledge_source_agents_agent_idx";

ALTER TABLE "knowledge_source_agents"
  DROP CONSTRAINT IF EXISTS "knowledge_source_agents_agent_id_agents_id_fk";
ALTER TABLE "knowledge_source_agents" DROP COLUMN IF EXISTS "agent_id";

CREATE UNIQUE INDEX "knowledge_source_agents_uidx"
  ON "knowledge_source_agents" ("organization_id", "source_id", "agent_key");
CREATE INDEX "knowledge_source_agents_agent_idx"
  ON "knowledge_source_agents" ("organization_id", "agent_key");

-- 3) Drop agents catalog
DROP TABLE IF EXISTS "agents" CASCADE;
