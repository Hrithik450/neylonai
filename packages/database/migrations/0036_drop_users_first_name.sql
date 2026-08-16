-- Preserve display names in username before dropping first_name.
UPDATE "users"
SET "username" = "first_name"
WHERE NULLIF(trim("first_name"), '') IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "users" DROP COLUMN IF EXISTS "first_name";
