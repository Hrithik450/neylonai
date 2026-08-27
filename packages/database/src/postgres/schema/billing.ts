import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  numeric,
  boolean,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { threads } from "./threads";

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
    /** active | trialing | past_due | cancelled | expired | suspended | inactive */
    status: varchar("status", { length: 32 }).notNull().default("active"),
    /** free | starter | pro | business */
    plan: varchar("plan", { length: 64 }).notNull().default("free"),
    /** Soft override; null = use plan catalog default. */
    monthly_request_limit: integer("monthly_request_limit"),
    /** Cached AI credit balance (ledger is source of truth). */
    ai_credits_balance: integer("ai_credits_balance").notNull().default(0),
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
    /**
     * The raw publishable key (nk_live_…), stored so the dashboard can show and
     * re-copy the exact install snippet without rotating. Safe at rest: this is a
     * *publishable* client key embedded in the site's HTML (à la Stripe pk_live) —
     * the `allowed_domains` allowlist, not secrecy, is the security boundary.
     * `key_hash` stays the auth source of truth. Null for keys created before
     * this column existed (they must be rotated to become copyable).
     */
    public_key: text("public_key"),
    /** Last 4 chars for dashboard display (never enough to reconstruct). */
    last_four: varchar("last_four", { length: 4 }).notNull(),
    /** List of allowed domains for CORS validation (e.g. ['example.com']). Empty = allow all. */
    allowed_domains: jsonb("allowed_domains").$type<string[]>().default([]),
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
    thread_id: uuid("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
    agent_id: varchar("agent_id", { length: 64 }),
    /** model | tool */
    resource_type: varchar("resource_type", { length: 16 }).notNull(),
    /** google | tavily | … */
    provider: varchar("provider", { length: 64 }).notNull(),
    /** Exact model id or tool id (e.g. gemini-3.5-flash-lite, tavily.search). */
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
    thread_id: uuid("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
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
    uniqueIndex("billing_events_provider_external_uidx")
      .on(t.provider, t.external_id)
      .where(sql`${t.external_id} is not null`),
  ],
);

/**
 * Per-request rollup: classifies complexity and credits for one chat request_id.
 * Built from usage_events + turn signals. Idempotent on (org, request_id).
 */
export const usageRequestRollups = pgTable(
  "usage_request_rollups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    request_id: varchar("request_id", { length: 64 }).notNull(),
    api_key_id: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    thread_id: uuid("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
    agent_id: varchar("agent_id", { length: 64 }),
    /** simple | standard | complex */
    complexity_class: varchar("complexity_class", { length: 32 }).notNull(),
    credits_charged: integer("credits_charged").notNull().default(0),
    routed_model: varchar("routed_model", { length: 120 }),
    complexity_tier: varchar("complexity_tier", { length: 16 }),
    route_source: varchar("route_source", { length: 16 }),
    agent_rounds: integer("agent_rounds").notNull().default(0),
    tool_calls: integer("tool_calls").notNull().default(0),
    tools_used: jsonb("tools_used").$type<string[]>().notNull().default([]),
    semantic_search_count: integer("semantic_search_count").notNull().default(0),
    input_tokens: integer("input_tokens").notNull().default(0),
    output_tokens: integer("output_tokens").notNull().default(0),
    provider_cost_micros: bigint("provider_cost_micros", { mode: "number" }),
    pricing_status: varchar("pricing_status", { length: 16 })
      .notNull()
      .default("unknown"),
    capped: boolean("capped").notNull().default(false),
    cap_reason: varchar("cap_reason", { length: 120 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("usage_request_rollups_org_request_uidx").on(
      t.organization_id,
      t.request_id,
    ),
    index("usage_request_rollups_org_created_idx").on(
      t.organization_id,
      t.created_at,
    ),
  ],
);

/**
 * AI credit ledger — source of truth for balances.
 * entry_type: plan_grant | ai_consumption | refund | adjustment | expiration
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entry_type: varchar("entry_type", { length: 32 }).notNull(),
    /** Positive = grant/refund; negative = consumption. */
    amount: integer("amount").notNull(),
    balance_after: integer("balance_after").notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    request_id: varchar("request_id", { length: 64 }),
    plan: varchar("plan", { length: 64 }),
    /** ISO date of the billing period for plan_grant rows. */
    period_key: varchar("period_key", { length: 64 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("credit_ledger_org_created_idx").on(t.organization_id, t.created_at),
    uniqueIndex("credit_ledger_consume_request_uidx")
      .on(t.organization_id, t.request_id)
      .where(
        sql`${t.request_id} is not null and ${t.entry_type} in ('ai_consumption', 'ai_on_demand')`,
      ),
    uniqueIndex("credit_ledger_plan_grant_period_uidx")
      .on(t.organization_id, t.period_key)
      .where(sql`${t.entry_type} = 'plan_grant' and ${t.period_key} is not null`),
  ],
);

/**
 * Period-keyed per-class request counters (used + in-flight reserved).
 * Source of truth for hard Simple/Standard/Complex caps.
 */
export const usageClassPeriodCounters = pgTable(
  "usage_class_period_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    period_start: timestamp("period_start", { withTimezone: true }).notNull(),
    /** simple | standard | complex */
    workload_class: varchar("workload_class", { length: 32 }).notNull(),
    used: integer("used").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("usage_class_period_counters_org_period_class_uidx").on(
      t.organization_id,
      t.period_start,
      t.workload_class,
    ),
  ],
);

/**
 * Per-request credit reservation. Holds shared-wallet credits for the
 * effective (affordability-remapped) class until delivery settles or aborts.
 * Class counters enforce plan query limits; routing permits one-way upward
 * borrowing and falls back to Simple runtime limits when capacity is exhausted.
 */
export const usageRequestReservations = pgTable(
  "usage_request_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    request_id: varchar("request_id", { length: 64 }).notNull(),
    workload_class: varchar("workload_class", { length: 32 }).notNull(),
    credits: integer("credits").notNull(),
    /** included reserves plan credits; on_demand is invoiced by the provider. */
    billing_mode: varchar("billing_mode", { length: 16 })
      .notNull()
      .default("included"),
    /** reserved | charged | released */
    status: varchar("status", { length: 16 }).notNull().default("reserved"),
    period_start: timestamp("period_start", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("usage_request_reservations_org_request_uidx").on(
      t.organization_id,
      t.request_id,
    ),
    index("usage_request_reservations_org_status_idx").on(
      t.organization_id,
      t.status,
    ),
  ],
);
