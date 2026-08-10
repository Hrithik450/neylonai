import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  numeric,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Subscription / entitlement for an organization.
 * Payment providers update status server-side via webhooks only.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /**
     * active | trialing | past_due | cancelled | expired | suspended | inactive
     * (also accepts legacy "canceled")
     */
    status: varchar("status", { length: 32 }).notNull().default("active"),
    /** free | starter | pro | business */
    plan: varchar("plan", { length: 64 }).notNull().default("free"),
    /** Soft override; null = use plan catalog default. */
    monthly_request_limit: integer("monthly_request_limit"),
    current_period_start: timestamp("current_period_start", {
      withTimezone: true,
    }).defaultNow(),
    current_period_end: timestamp("current_period_end", {
      withTimezone: true,
    }),
    /** stripe | razorpay | paypal | manual | null */
    payment_provider: varchar("payment_provider", { length: 32 }),
    external_customer_id: varchar("external_customer_id", { length: 255 }),
    external_subscription_id: varchar("external_subscription_id", {
      length: 255,
    }),
    canceled_at: timestamp("canceled_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_organization_uidx").on(t.organization_id),
    index("subscriptions_status_idx").on(t.status),
  ],
);

/**
 * Client/public API keys for embeddable chatbot installations.
 * Only `key_hash` is secret material; `key_prefix` is used for lookup.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("Default"),
    /** e.g. nk_live_abcd12 — first 12 chars of the full key for indexed lookup. */
    key_prefix: varchar("key_prefix", { length: 16 }).notNull(),
    /** SHA-256 hex digest of the full API key. */
    key_hash: text("key_hash").notNull(),
    /** Last 4 chars for dashboard display (never enough to reconstruct). */
    last_four: varchar("last_four", { length: 4 }).notNull(),
    /** Allowed Origin / hostnames for SDK requests. Empty = unrestricted. */
    allowed_origins: jsonb("allowed_origins")
      .$type<string[]>()
      .notNull()
      .default([]),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("api_keys_prefix_uidx").on(t.key_prefix),
    index("api_keys_organization_id_idx").on(t.organization_id),
  ],
);

/**
 * Provider COGS metering — one row per model or external tool resource consumed.
 * Not product entitlements; not Evently analytics; not pgvector infra.
 *
 * Historical pre-metering rows (if any) live in DB table usage_events_legacy
 * and are not mapped here — incomplete for COGS and not used by the app.
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    api_key_id: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    /** Correlates all resources in one chat/suggestions request. */
    request_id: varchar("request_id", { length: 64 }).notNull(),
    thread_id: uuid("thread_id"),
    agent_id: varchar("agent_id", { length: 64 }),
    /** model | tool */
    resource_type: varchar("resource_type", { length: 16 }).notNull(),
    /** google | tavily | … */
    provider: varchar("provider", { length: 64 }).notNull(),
    /** Exact model id or tool id (e.g. gemini-3.5-flash, tavily.search). */
    service: varchar("service", { length: 120 }).notNull(),
    /** Tool operation when applicable (e.g. basic). */
    operation: varchar("operation", { length: 64 }),
    input_tokens: integer("input_tokens").notNull().default(0),
    output_tokens: integer("output_tokens").notNull().default(0),
    /** Non-token quantity (e.g. Tavily credits). */
    quantity: numeric("quantity", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    /** tokens | credit | request | … */
    unit: varchar("unit", { length: 32 }).notNull(),
    /**
     * Provider COGS in USD micros (1e-6 USD). Null when pricing is unverified.
     * Never invent a number — leave null and set pricing_status = unknown.
     */
    provider_cost_micros: bigint("provider_cost_micros", { mode: "number" }),
    /** verified | unknown */
    pricing_status: varchar("pricing_status", { length: 16 })
      .notNull()
      .default("unknown"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("usage_events_org_created_idx").on(t.organization_id, t.created_at),
    index("usage_events_org_provider_idx").on(t.organization_id, t.provider),
    index("usage_events_request_idx").on(t.request_id),
  ],
);

/**
 * Product entitlement counters (separate from provider COGS).
 * metric: conversation_turn | proactive_refresh
 */
export const productUsageEvents = pgTable(
  "product_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    api_key_id: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    metric: varchar("metric", { length: 64 }).notNull(),
    request_id: varchar("request_id", { length: 64 }),
    thread_id: uuid("thread_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("product_usage_events_org_metric_created_idx").on(
      t.organization_id,
      t.metric,
      t.created_at,
    ),
  ],
);

/** Payment / invoice ledger (provider-agnostic). */
export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscription_id: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 32 }).notNull(),
    /** checkout_started | payment_succeeded | payment_failed | subscription_updated | canceled */
    event_type: varchar("event_type", { length: 64 }).notNull(),
    external_id: varchar("external_id", { length: 255 }),
    amount_cents: integer("amount_cents"),
    currency: varchar("currency", { length: 8 }).default("usd"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("billing_events_org_created_idx").on(t.organization_id, t.created_at),
  ],
);
