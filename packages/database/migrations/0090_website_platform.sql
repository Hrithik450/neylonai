-- organization_settings.website_platform records the site builder the user
-- selects in the onboarding wizard (coded | wordpress | wix | framer | webflow).
-- Only "coded" surfaces the install script today; the others show "Coming soon"
-- while per-platform install flows are built. Nullable: existing orgs and any
-- org that hasn't finished onboarding keep website_platform = NULL.
ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "website_platform" varchar(32);
