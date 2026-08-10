-- Slim conversation_states: drop ticket-style columns; normalize status.

-- Map legacy statuses → open | escalated | resolved
UPDATE conversation_states
SET status = CASE
  WHEN status IN ('escalated') THEN 'escalated'
  WHEN status IN ('resolved') THEN 'resolved'
  ELSE 'open'
END;

ALTER TABLE conversation_states
  ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE conversation_states
  DROP COLUMN IF EXISTS assigned_human_id,
  DROP COLUMN IF EXISTS assigned_team,
  DROP COLUMN IF EXISTS escalation_trigger,
  DROP COLUMN IF EXISTS escalated_by_agent_id,
  DROP COLUMN IF EXISTS conversation_summary,
  DROP COLUMN IF EXISTS handoff_history,
  DROP COLUMN IF EXISTS ai_paused;
