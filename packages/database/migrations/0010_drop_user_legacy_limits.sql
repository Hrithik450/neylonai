-- Legacy per-user token/resume quotas (unused by Neylon AI SaaS billing).
ALTER TABLE "user" DROP COLUMN IF EXISTS "daily_limit";
ALTER TABLE "user" DROP COLUMN IF EXISTS "resume_generation_limit";
