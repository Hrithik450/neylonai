-- Encrypted per-integration credentials (connection URLs, OAuth tokens, …).
-- Public metadata stays on organization_integrations.config.

CREATE TABLE IF NOT EXISTS "organization_integration_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "organization_integration_id" uuid NOT NULL REFERENCES "organization_integrations"("id") ON DELETE CASCADE,
  "secret_key" varchar(64) NOT NULL,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "key_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_integration_secrets_integration_key_uidx"
  ON "organization_integration_secrets" ("organization_integration_id", "secret_key");

CREATE INDEX IF NOT EXISTS "organization_integration_secrets_organization_id_idx"
  ON "organization_integration_secrets" ("organization_id");
