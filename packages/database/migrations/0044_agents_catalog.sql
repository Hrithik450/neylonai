-- Agent catalog: public platform agents + private org agents.
-- organization_agents.agent_id becomes an FK into agents.

CREATE TABLE IF NOT EXISTS "agents" (
  "id" varchar(64) PRIMARY KEY,
  "name" text NOT NULL,
  "purpose" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "visibility" varchar(16) NOT NULL DEFAULT 'public',
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "role" varchar(32) NOT NULL DEFAULT 'specialized',
  "kind" varchar(32) NOT NULL DEFAULT 'blueprint',
  "tier" varchar(16) NOT NULL DEFAULT 'basic',
  "runnable" boolean NOT NULL DEFAULT false,
  "default_active" boolean NOT NULL DEFAULT false,
  "built_in" boolean NOT NULL DEFAULT false,
  "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "model_label" text NOT NULL DEFAULT '—',
  "system_prompt" text,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "integration_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "required_integration_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "outcome_metric_key" varchar(64) NOT NULL DEFAULT 'outcomes',
  "outcome_metric_label" text NOT NULL DEFAULT 'Outcomes',
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
  CONSTRAINT "agents_kind_values_check"
    CHECK ("kind" IN ('runtime', 'blueprint')),
  CONSTRAINT "agents_tier_values_check"
    CHECK ("tier" IN ('basic', 'advanced'))
);

CREATE INDEX IF NOT EXISTS "agents_organization_id_idx"
  ON "agents" ("organization_id");

CREATE INDEX IF NOT EXISTS "agents_visibility_idx"
  ON "agents" ("visibility");

-- Seed public platform agents (Main + specialized blueprints).
INSERT INTO "agents" (
  "id", "name", "purpose", "description", "visibility", "organization_id",
  "role", "kind", "tier", "runnable", "default_active", "built_in",
  "capabilities", "model_label", "system_prompt", "config",
  "integration_ids", "required_integration_ids",
  "outcome_metric_key", "outcome_metric_label"
) VALUES
(
  'neylonai-chatbot',
  'Main Agent',
  'Primary conversational agent',
  'The default entry point for visitor chats. It answers from your knowledge, can share a booking link, escalate to a human, and use connected tools. Specialized agents below are optional blueprints for future domain focus — not a multi-agent runtime.',
  'public',
  NULL,
  'main',
  'runtime',
  'basic',
  true,
  true,
  true,
  '["Knowledge search","Booking link","Human escalation","Web search","Database query"]'::jsonb,
  'Routed (low / medium / high)',
  NULL,
  '{}'::jsonb,
  '["website","database","pdf","web_search","calcom"]'::jsonb,
  '[]'::jsonb,
  'questions_answered',
  'Conversations handled'
),
(
  'support',
  'Support Agent',
  'Customer support & troubleshooting',
  'Blueprint for a support-focused specialist: troubleshooting, FAQs, and product help. In the MVP this does not run chats — the Main Agent handles support with knowledge and escalation tools.',
  'public',
  NULL,
  'specialized',
  'blueprint',
  'basic',
  false,
  false,
  true,
  '["Knowledge search","Troubleshooting playbooks","Human escalation"]'::jsonb,
  'Medium (planned)',
  'You are a Support Agent blueprint. You are not active on live chats in this MVP.',
  '{}'::jsonb,
  '["website","pdf","database"]'::jsonb,
  '[]'::jsonb,
  'questions_answered',
  'Support conversations'
),
(
  'sales',
  'Sales Agent',
  'Qualification & product discussions',
  'Blueprint for sales-oriented conversations: qualification, product fit, and buying signals. Not active on live chats yet.',
  'public',
  NULL,
  'specialized',
  'blueprint',
  'advanced',
  false,
  false,
  true,
  '["Prospect qualification","Product discussions","Buying-signal notes","CRM handoff (planned)"]'::jsonb,
  'High (planned)',
  'You are a Sales Agent blueprint. You are not active on live chats in this MVP.',
  '{}'::jsonb,
  '["hubspot","salesforce","slack","webhooks"]'::jsonb,
  '[]'::jsonb,
  'prospects_qualified',
  'Prospects qualified'
),
(
  'technical',
  'Technical Support Agent',
  'Deep technical & product issues',
  'Blueprint for deeper technical troubleshooting: APIs, integrations, debugging-style guidance. Not operational in the MVP.',
  'public',
  NULL,
  'specialized',
  'blueprint',
  'advanced',
  false,
  false,
  true,
  '["Technical troubleshooting","Integration debugging","Knowledge search","Escalate complex cases"]'::jsonb,
  'High (planned)',
  'You are a Technical Support Agent blueprint. You are not active on live chats in this MVP.',
  '{}'::jsonb,
  '["website","database","pdf"]'::jsonb,
  '[]'::jsonb,
  'technical_issues_resolved',
  'Technical issues handled'
)
ON CONFLICT ("id") DO NOTHING;

-- Drop orphan organization_agents rows that cannot satisfy the new FK.
DELETE FROM "organization_agents" oa
WHERE NOT EXISTS (SELECT 1 FROM "agents" a WHERE a."id" = oa."agent_id");

ALTER TABLE "organization_agents"
  ADD CONSTRAINT "organization_agents_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "organization_agents"
  VALIDATE CONSTRAINT "organization_agents_agent_id_agents_id_fk";
