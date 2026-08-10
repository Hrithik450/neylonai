-- Lightweight tickets for human follow-up on conversations

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'open',
  assigned_human_id uuid,
  assigned_team varchar(120),
  agent_id varchar(64),
  agent_name varchar(120),
  escalation_reason text,
  escalation_trigger varchar(64),
  page_path text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_org_status_idx
  ON tickets (organization_id, status);
CREATE INDEX IF NOT EXISTS tickets_thread_idx
  ON tickets (thread_id);

ALTER TABLE conversation_states
  ADD COLUMN IF NOT EXISTS ticket_id uuid;
