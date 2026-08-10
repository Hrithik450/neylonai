-- Lead Agent + Human Handoff (conversation lifecycle + engagement settings)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS status varchar(32) DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS source_agent_id varchar(64),
  ADD COLUMN IF NOT EXISTS crm_sync_status varchar(32) DEFAULT 'not_configured';

CREATE TABLE IF NOT EXISTS conversation_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'ai_active',
  assigned_agent_id varchar(64),
  assigned_human_id uuid,
  assigned_team varchar(120),
  escalation_reason text,
  escalation_trigger varchar(64),
  escalated_at timestamptz,
  escalated_by_agent_id varchar(64),
  lead_id uuid,
  conversation_summary text,
  handoff_history jsonb DEFAULT '[]'::jsonb,
  ai_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_states_thread_uidx
  ON conversation_states (thread_id);
CREATE INDEX IF NOT EXISTS conversation_states_org_status_idx
  ON conversation_states (organization_id, status);

CREATE TABLE IF NOT EXISTS organization_engagement_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_agent_enabled boolean NOT NULL DEFAULT true,
  lead_fields jsonb NOT NULL DEFAULT '["name","email","company"]'::jsonb,
  human_handoff_enabled boolean NOT NULL DEFAULT true,
  escalation_conditions jsonb NOT NULL DEFAULT '{"explicitHumanRequest":true,"repeatedUnhelpful":true,"frustration":true,"lowConfidence":true,"businessRules":true}'::jsonb,
  default_team varchar(120) DEFAULT 'support',
  availability_mode varchar(32) NOT NULL DEFAULT 'collect_contact',
  business_hours_note text DEFAULT 'Our team typically replies within one business day.',
  customer_handoff_message text DEFAULT 'I’m connecting you with a teammate who can help further. Hang tight — they’ll pick this up shortly.',
  unavailable_message text DEFAULT 'Our team isn’t immediately available right now. Share the best way to reach you and we’ll follow up soon.',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_engagement_settings_org_uidx
  ON organization_engagement_settings (organization_id);
