-- Sitemap-first evergreen website crawls: jobs, per-URL state, monthly budget.

ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "content_hash" text;
--> statement-breakpoint

ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "sitemap_lastmod" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "website_crawl_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "organization_integration_id" uuid NOT NULL REFERENCES "organization_integrations"("id") ON DELETE CASCADE,
  "knowledge_source_id" uuid REFERENCES "knowledge_sources"("id") ON DELETE SET NULL,
  "seed_url" text NOT NULL,
  "max_pages" integer NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'queued',
  "source" varchar(16),
  "found_count" integer NOT NULL DEFAULT 0,
  "eligible_count" integer NOT NULL DEFAULT 0,
  "selected_count" integer NOT NULL DEFAULT 0,
  "scraped_count" integer NOT NULL DEFAULT 0,
  "skipped_count" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0,
  "reserved_pages" integer NOT NULL DEFAULT 0,
  "consumed_pages" integer NOT NULL DEFAULT 0,
  "released_pages" integer NOT NULL DEFAULT 0,
  "categories" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" text,
  "provider" varchar(32),
  "year_month" varchar(7) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "website_crawl_jobs_status_check"
    CHECK ("status" IN (
      'queued',
      'discovering',
      'crawling',
      'cancelling',
      'completed',
      'failed',
      'cancelled'
    )),
  CONSTRAINT "website_crawl_jobs_max_pages_check"
    CHECK ("max_pages" > 0)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "website_crawl_jobs_org_created_idx"
  ON "website_crawl_jobs" ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "website_crawl_jobs_org_integration_idx"
  ON "website_crawl_jobs" ("organization_id", "organization_integration_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "website_crawl_jobs_status_idx"
  ON "website_crawl_jobs" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "website_crawl_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "website_crawl_jobs"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "canonical_path" text NOT NULL,
  "lastmod" text,
  "category" varchar(32),
  "status" varchar(24) NOT NULL DEFAULT 'selected',
  "content_hash" text,
  "error" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "provider" varchar(32),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "website_crawl_pages_status_check"
    CHECK ("status" IN (
      'selected',
      'skipped_lastmod',
      'skipped_hash',
      'scraped',
      'failed',
      'cancelled'
    ))
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "website_crawl_pages_job_path_uidx"
  ON "website_crawl_pages" ("job_id", "canonical_path");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "website_crawl_pages_job_status_idx"
  ON "website_crawl_pages" ("job_id", "status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "website_crawl_pages_organization_id_idx"
  ON "website_crawl_pages" ("organization_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "website_crawl_budget_months" (
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "year_month" varchar(7) NOT NULL,
  "reserved" integer NOT NULL DEFAULT 0,
  "consumed" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("organization_id", "year_month"),
  CONSTRAINT "website_crawl_budget_months_nonneg_check"
    CHECK ("reserved" >= 0 AND "consumed" >= 0)
);
