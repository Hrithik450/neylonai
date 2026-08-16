import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { organizationIntegrations } from "./integrations";
import { knowledgeSources } from "./knowledge";

export const WEBSITE_CRAWL_JOB_STATUSES = [
  "queued",
  "discovering",
  "crawling",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
] as const;

export type WebsiteCrawlJobStatus = (typeof WEBSITE_CRAWL_JOB_STATUSES)[number];

export const WEBSITE_CRAWL_JOB_MODES = [
  "initial",
  "refresh",
  "retry_failed",
] as const;

export type WebsiteCrawlJobMode = (typeof WEBSITE_CRAWL_JOB_MODES)[number];

export const WEBSITE_CRAWL_PAGE_STATUSES = [
  "selected",
  "skipped_lastmod",
  "skipped_existing",
  "skipped_hash",
  "scraped",
  "not_found",
  "failed",
  "cancelled",
] as const;

export type WebsiteCrawlPageStatus = (typeof WEBSITE_CRAWL_PAGE_STATUSES)[number];

export const websiteCrawlJobs = pgTable(
  "website_crawl_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    organization_integration_id: uuid("organization_integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    knowledge_source_id: uuid("knowledge_source_id").references(
      () => knowledgeSources.id,
      { onDelete: "set null" },
    ),
    seed_url: text("seed_url").notNull(),
    max_pages: integer("max_pages").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    mode: varchar("mode", { length: 24 }).notNull().default("initial"),
    budget_limit: integer("budget_limit").notNull(),
    source: varchar("source", { length: 16 }),
    found_count: integer("found_count").notNull().default(0),
    eligible_count: integer("eligible_count").notNull().default(0),
    selected_count: integer("selected_count").notNull().default(0),
    scraped_count: integer("scraped_count").notNull().default(0),
    skipped_count: integer("skipped_count").notNull().default(0),
    failed_count: integer("failed_count").notNull().default(0),
    reserved_pages: integer("reserved_pages").notNull().default(0),
    consumed_pages: integer("consumed_pages").notNull().default(0),
    released_pages: integer("released_pages").notNull().default(0),
    error: text("error"),
    provider: varchar("provider", { length: 32 }),
    year_month: varchar("year_month", { length: 7 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    started_at: timestamp("started_at", { withTimezone: true }),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("website_crawl_jobs_org_created_idx").on(
      t.organization_id,
      t.created_at,
    ),
    index("website_crawl_jobs_org_integration_idx").on(
      t.organization_id,
      t.organization_integration_id,
    ),
    index("website_crawl_jobs_status_idx").on(t.status),
  ],
);

export const websiteCrawlPages = pgTable(
  "website_crawl_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    job_id: uuid("job_id")
      .notNull()
      .references(() => websiteCrawlJobs.id, { onDelete: "cascade" }),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonical_path: text("canonical_path").notNull(),
    lastmod: text("lastmod"),
    category: varchar("category", { length: 32 }),
    status: varchar("status", { length: 24 }).notNull().default("selected"),
    content_hash: text("content_hash"),
    error: text("error"),
    http_status: integer("http_status"),
    retry_count: integer("retry_count").notNull().default(0),
    provider: varchar("provider", { length: 32 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("website_crawl_pages_job_path_uidx").on(
      t.job_id,
      t.canonical_path,
    ),
    index("website_crawl_pages_job_status_idx").on(t.job_id, t.status),
    index("website_crawl_pages_organization_id_idx").on(t.organization_id),
  ],
);

export const websiteCrawlBudgetMonths = pgTable(
  "website_crawl_budget_months",
  {
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    year_month: varchar("year_month", { length: 7 }).notNull(),
    reserved: integer("reserved").notNull().default(0),
    consumed: integer("consumed").notNull().default(0),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organization_id, t.year_month] })],
);
