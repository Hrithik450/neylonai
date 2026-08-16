-- Drop unused CDN URL columns; fonts/logos are served via API + storage_key.

ALTER TABLE "organization_fonts" DROP COLUMN IF EXISTS "public_url";
--> statement-breakpoint

ALTER TABLE "organization_logos" DROP COLUMN IF EXISTS "public_url";
