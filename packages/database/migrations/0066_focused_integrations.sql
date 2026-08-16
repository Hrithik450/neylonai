-- Keep only the focused integration catalog and make website refreshes explicit.

DELETE FROM "organization_integrations"
WHERE "integration_id" IN (
  'pdf',
  'google_drive',
  'hubspot',
  'salesforce',
  'slack',
  'webhooks',
  'calendly',
  'evently'
);
--> statement-breakpoint

ALTER TABLE "website_crawl_jobs"
  ADD COLUMN IF NOT EXISTS "mode" varchar(24) NOT NULL DEFAULT 'initial';
--> statement-breakpoint

ALTER TABLE "website_crawl_jobs"
  ADD COLUMN IF NOT EXISTS "budget_limit" integer NOT NULL DEFAULT 8;
--> statement-breakpoint

ALTER TABLE "website_crawl_jobs"
  ADD CONSTRAINT "website_crawl_jobs_mode_check"
  CHECK ("mode" IN ('initial', 'refresh', 'retry_failed'));
--> statement-breakpoint

ALTER TABLE "website_crawl_pages"
  ADD COLUMN IF NOT EXISTS "error_code" varchar(64);
--> statement-breakpoint

ALTER TABLE "website_crawl_pages"
  ADD COLUMN IF NOT EXISTS "http_status" integer;
--> statement-breakpoint

ALTER TABLE "website_crawl_pages"
  DROP CONSTRAINT IF EXISTS "website_crawl_pages_status_check";
--> statement-breakpoint

ALTER TABLE "website_crawl_pages"
  ADD CONSTRAINT "website_crawl_pages_status_check"
  CHECK ("status" IN (
    'selected',
    'skipped_lastmod',
    'skipped_existing',
    'skipped_hash',
    'scraped',
    'not_found',
    'failed',
    'cancelled'
  ));
