-- Rename dashboard org ↔ Neylon user link (not widget participants).

ALTER TABLE "organization_members" RENAME TO "organization_accounts";
--> statement-breakpoint

ALTER INDEX IF EXISTS "organization_members_org_user_uidx"
  RENAME TO "organization_accounts_org_user_uidx";
--> statement-breakpoint

ALTER INDEX IF EXISTS "organization_members_user_uidx"
  RENAME TO "organization_accounts_user_uidx";
--> statement-breakpoint

ALTER TABLE "organization_accounts"
  RENAME CONSTRAINT "organization_members_organization_id_organizations_id_fk"
  TO "organization_accounts_organization_id_organizations_id_fk";
--> statement-breakpoint

ALTER TABLE "organization_accounts"
  RENAME CONSTRAINT "organization_members_user_id_user_id_fk"
  TO "organization_accounts_user_id_users_id_fk";
