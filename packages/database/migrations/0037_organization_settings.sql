-- Rename + slim organization settings (keep retention + timezone only).

ALTER TABLE IF EXISTS "organization_workspace_settings" RENAME TO "organization_settings";
--> statement-breakpoint

ALTER INDEX IF EXISTS "organization_workspace_settings_org_uidx"
  RENAME TO "organization_settings_org_uidx";
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_workspace_settings_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "organization_settings"
      RENAME CONSTRAINT "organization_workspace_settings_organization_id_organizations_id_fk"
      TO "organization_settings_organization_id_organizations_id_fk";
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "customer_facing_name";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "logo_url";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "default_language";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "notifications";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "sso";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "webhook_url";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "webhook_secret_last_four";
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "webhook_secret_hash";
--> statement-breakpoint

UPDATE "organization_settings"
SET "privacy" = jsonb_build_object(
  'conversationRetentionDays',
  COALESCE(
    NULLIF(("privacy"->>'conversationRetentionDays'), '')::int,
    365
  )
)
WHERE "privacy" IS NOT NULL;
