-- Reshape agents catalog: UUID PK, status, capabilities text, extra jsonb.
-- Add integrations catalog + agent_required_integrations FK junction.
-- Remap organization_agents.agent_id to UUID.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Integrations catalog
CREATE TABLE IF NOT EXISTS "integrations" (
  "id" varchar(64) PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamptz DEFAULT now()
);

INSERT INTO "integrations" ("id", "name", "description") VALUES
  ('website', 'Website', 'Import website content into knowledge'),
  ('pdf', 'PDF', 'Import PDF documents into knowledge'),
  ('database', 'Database', 'Connect a read-only Postgres database'),
  ('web_search', 'Web Search', 'Open-web search for the Main Agent'),
  ('google_drive', 'Google Drive', 'Google Drive import'),
  ('hubspot', 'HubSpot', 'HubSpot CRM'),
  ('salesforce', 'Salesforce', 'Salesforce CRM'),
  ('slack', 'Slack', 'Slack notifications'),
  ('whatsapp', 'WhatsApp', 'WhatsApp channel'),
  ('webhooks', 'Webhooks', 'Outbound webhooks'),
  ('calcom', 'Cal.com', 'Cal.com booking links'),
  ('calendly', 'Calendly', 'Calendly booking'),
  ('evently', 'Evently', 'Product analytics')
ON CONFLICT ("id") DO NOTHING;

-- 2) Drop old org→agent FK before rebuild
ALTER TABLE "organization_agents"
  DROP CONSTRAINT IF EXISTS "organization_agents_agent_id_agents_id_fk";

-- 3) New agents table
CREATE TABLE IF NOT EXISTS "agents_new" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(64),
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "visibility" varchar(16) NOT NULL DEFAULT 'public',
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "role" varchar(32) NOT NULL DEFAULT 'specialized',
  "tier" varchar(16) NOT NULL DEFAULT 'basic',
  "status" varchar(16) NOT NULL DEFAULT 'inactive',
  "default_active" boolean NOT NULL DEFAULT false,
  "capabilities" text NOT NULL DEFAULT '',
  "system_prompt" text,
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "agents_visibility_values_check"
    CHECK ("visibility" IN ('public', 'private')),
  CONSTRAINT "agents_visibility_org_check"
    CHECK (
      ("visibility" = 'public' AND "organization_id" IS NULL)
      OR ("visibility" = 'private' AND "organization_id" IS NOT NULL)
    ),
  CONSTRAINT "agents_role_values_check"
    CHECK ("role" IN ('main', 'specialized')),
  CONSTRAINT "agents_tier_values_check"
    CHECK ("tier" IN ('basic', 'advanced')),
  CONSTRAINT "agents_status_values_check"
    CHECK ("status" IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "agents_slug_uidx" ON "agents_new" ("slug");
CREATE INDEX IF NOT EXISTS "agents_organization_id_idx" ON "agents_new" ("organization_id");
CREATE INDEX IF NOT EXISTS "agents_visibility_idx" ON "agents_new" ("visibility");
CREATE INDEX IF NOT EXISTS "agents_status_idx" ON "agents_new" ("status");

-- 4) Migrate from legacy varchar-id agents table when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agents'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'purpose'
  ) THEN
    INSERT INTO "agents_new" (
      "slug", "name", "description", "visibility", "organization_id",
      "role", "tier", "status", "default_active", "capabilities",
      "system_prompt", "extra", "created_at", "updated_at"
    )
    SELECT
      a."id",
      a."name",
      COALESCE(a."description", ''),
      a."visibility",
      a."organization_id",
      a."role",
      a."tier",
      CASE
        WHEN a."role" = 'main' THEN 'active'
        WHEN COALESCE(a."runnable", false) THEN 'active'
        ELSE 'inactive'
      END,
      COALESCE(a."default_active", false),
      CASE
        WHEN jsonb_typeof(a."capabilities") = 'array' THEN (
          SELECT COALESCE(string_agg(elem, ', '), '')
          FROM jsonb_array_elements_text(a."capabilities") AS elem
        )
        ELSE ''
      END,
      a."system_prompt",
      COALESCE(a."config", '{}'::jsonb),
      a."created_at",
      a."updated_at"
    FROM "agents" a
    WHERE NOT EXISTS (
      SELECT 1 FROM "agents_new" n WHERE n."slug" = a."id"
    );
  END IF;
END $$;

-- 5) Seed public agents by slug
INSERT INTO "agents_new" (
  "slug", "name", "description", "visibility", "organization_id",
  "role", "tier", "status", "default_active", "capabilities",
  "system_prompt", "extra"
)
SELECT v.slug, v.name, v.description, v.visibility, v.organization_id,
       v.role, v.tier, v.status, v.default_active, v.capabilities,
       v.system_prompt, v.extra
FROM (
  VALUES
  (
    'neylonai-chatbot',
    'Main Agent',
    'The default entry point for visitor chats. It answers from your knowledge, can share a booking link, escalate to a human, and use connected tools.',
    'public',
    NULL::uuid,
    'main',
    'basic',
    'active',
    true,
    'Knowledge search, Booking link, Human escalation, Web search, Database query',
    NULL::text,
    '{}'::jsonb
  ),
  (
    'support',
    'Support Agent',
    'Blueprint for a support-focused specialist: troubleshooting, FAQs, and product help. Live chats stay on the Main Agent in this MVP.',
    'public',
    NULL::uuid,
    'specialized',
    'basic',
    'inactive',
    false,
    'Knowledge search, Troubleshooting playbooks, Human escalation',
    'You are a Support Agent blueprint. You are not active on live chats in this MVP.',
    '{}'::jsonb
  ),
  (
    'sales',
    'Sales Agent',
    'Blueprint for sales-oriented conversations: qualification, product fit, and buying signals. Not active on live chats yet.',
    'public',
    NULL::uuid,
    'specialized',
    'advanced',
    'inactive',
    false,
    'Prospect qualification, Product discussions, Buying-signal notes, CRM handoff (planned)',
    'You are a Sales Agent blueprint. You are not active on live chats in this MVP.',
    '{}'::jsonb
  ),
  (
    'technical',
    'Technical Support Agent',
    'Blueprint for deeper technical troubleshooting: APIs, integrations, debugging-style guidance. Not operational in the MVP.',
    'public',
    NULL::uuid,
    'specialized',
    'advanced',
    'inactive',
    false,
    'Technical troubleshooting, Integration debugging, Knowledge search, Escalate complex cases',
    'You are a Technical Support Agent blueprint. You are not active on live chats in this MVP.',
    '{}'::jsonb
  )
) AS v(
  slug, name, description, visibility, organization_id,
  role, tier, status, default_active, capabilities, system_prompt, extra
)
WHERE NOT EXISTS (
  SELECT 1 FROM "agents_new" n WHERE n."slug" = v.slug
);

-- 6) Remap organization_agents.agent_id → uuid
ALTER TABLE "organization_agents" ADD COLUMN IF NOT EXISTS "agent_id_uuid" uuid;

UPDATE "organization_agents" oa
SET "agent_id_uuid" = n."id"
FROM "agents_new" n
WHERE oa."agent_id_uuid" IS NULL
  AND n."slug" = oa."agent_id"::text;

DELETE FROM "organization_agents" WHERE "agent_id_uuid" IS NULL;

DROP INDEX IF EXISTS "organization_agents_org_agent_uidx";

ALTER TABLE "organization_agents" DROP COLUMN IF EXISTS "agent_id";
ALTER TABLE "organization_agents" RENAME COLUMN "agent_id_uuid" TO "agent_id";
ALTER TABLE "organization_agents" ALTER COLUMN "agent_id" SET NOT NULL;

CREATE UNIQUE INDEX "organization_agents_org_agent_uidx"
  ON "organization_agents" ("organization_id", "agent_id");

-- 7) Swap agents tables
DROP TABLE IF EXISTS "agents" CASCADE;
ALTER TABLE "agents_new" RENAME TO "agents";

ALTER TABLE "organization_agents"
  DROP CONSTRAINT IF EXISTS "organization_agents_agent_id_agents_id_fk";

ALTER TABLE "organization_agents"
  ADD CONSTRAINT "organization_agents_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "organization_agents"
  VALIDATE CONSTRAINT "organization_agents_agent_id_agents_id_fk";

-- 8) Required integrations junction
CREATE TABLE IF NOT EXISTS "agent_required_integrations" (
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "integration_id" varchar(64) NOT NULL REFERENCES "integrations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("agent_id", "integration_id")
);
