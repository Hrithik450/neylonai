-- Workspace account settings + team invites

CREATE TABLE IF NOT EXISTS organization_workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_facing_name varchar(255),
  logo_url text,
  timezone varchar(64) NOT NULL DEFAULT 'UTC',
  default_language varchar(16) NOT NULL DEFAULT 'en',
  notifications jsonb NOT NULL DEFAULT '{"humanHandoffEmail":true,"humanHandoffSlack":true,"ticketEmail":true,"ticketSlack":true,"leadEmail":true,"leadSlack":false}'::jsonb,
  privacy jsonb NOT NULL DEFAULT '{"conversationRetentionDays":365,"allowDataExport":true,"anonymizeVisitorIds":false}'::jsonb,
  sso jsonb NOT NULL DEFAULT '{"enabled":false,"provider":null,"notes":null}'::jsonb,
  webhook_url text,
  webhook_secret_last_four varchar(4),
  webhook_secret_hash text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_workspace_settings_org_uidx
  ON organization_workspace_settings (organization_id);

CREATE TABLE IF NOT EXISTS organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email varchar(254) NOT NULL,
  role varchar(32) NOT NULL DEFAULT 'member',
  invited_by_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS organization_invites_org_idx
  ON organization_invites (organization_id);
CREATE INDEX IF NOT EXISTS organization_invites_email_idx
  ON organization_invites (email);
