-- Remap knowledge_source_agents.agent_id (varchar slug) → uuid FK to agents.id

ALTER TABLE "knowledge_source_agents" ADD COLUMN IF NOT EXISTS "agent_id_uuid" uuid;

-- Prefer slug match (legacy varchar values)
UPDATE "knowledge_source_agents" ksa
SET "agent_id_uuid" = a."id"
FROM "agents" a
WHERE ksa."agent_id_uuid" IS NULL
  AND a."slug" IS NOT NULL
  AND a."slug" = ksa."agent_id"::text;

-- Also accept values that are already agent UUID text
UPDATE "knowledge_source_agents" ksa
SET "agent_id_uuid" = a."id"
FROM "agents" a
WHERE ksa."agent_id_uuid" IS NULL
  AND a."id"::text = ksa."agent_id"::text;

DELETE FROM "knowledge_source_agents" WHERE "agent_id_uuid" IS NULL;

DROP INDEX IF EXISTS "knowledge_source_agents_uidx";
DROP INDEX IF EXISTS "knowledge_source_agents_agent_idx";

ALTER TABLE "knowledge_source_agents" DROP COLUMN IF EXISTS "agent_id";
ALTER TABLE "knowledge_source_agents" RENAME COLUMN "agent_id_uuid" TO "agent_id";
ALTER TABLE "knowledge_source_agents" ALTER COLUMN "agent_id" SET NOT NULL;

CREATE UNIQUE INDEX "knowledge_source_agents_uidx"
  ON "knowledge_source_agents" ("organization_id", "source_id", "agent_id");
CREATE INDEX "knowledge_source_agents_agent_idx"
  ON "knowledge_source_agents" ("organization_id", "agent_id");

ALTER TABLE "knowledge_source_agents"
  DROP CONSTRAINT IF EXISTS "knowledge_source_agents_agent_id_agents_id_fk";

ALTER TABLE "knowledge_source_agents"
  ADD CONSTRAINT "knowledge_source_agents_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "knowledge_source_agents"
  VALIDATE CONSTRAINT "knowledge_source_agents_agent_id_agents_id_fk";
