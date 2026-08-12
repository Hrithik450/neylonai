import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("organizations_slug_uidx").on(t.slug)],
);

/** User ↔ organization membership (solo founder: one org per user). */
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_members_org_user_uidx").on(
      t.organization_id,
      t.user_id,
    ),
    uniqueIndex("organization_members_user_uidx").on(t.user_id),
  ],
);

export type WorkspaceNotificationPrefs = {
  humanHandoffEmail: boolean;
  humanHandoffSlack: boolean;
  ticketEmail: boolean;
  ticketSlack: boolean;
  leadEmail: boolean;
  leadSlack: boolean;
};

export type WorkspacePrivacyPrefs = {
  conversationRetentionDays: number | null;
  allowDataExport: boolean;
  anonymizeVisitorIds: boolean;
};

export type WorkspaceSsoPrep = {
  enabled: boolean;
  provider: string | null;
  notes: string | null;
};

/**
 * Org-scoped account settings (General, Notifications, Privacy, SSO prep).
 * Feature config (widget, agents, knowledge, CRM) stays in those products.
 */
export const organizationWorkspaceSettings = pgTable(
  "organization_workspace_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customer_facing_name: varchar("customer_facing_name", { length: 255 }),
    logo_url: text("logo_url"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    default_language: varchar("default_language", { length: 16 })
      .notNull()
      .default("en"),
    notifications: jsonb("notifications")
      .$type<WorkspaceNotificationPrefs>()
      .notNull()
      .default({
        humanHandoffEmail: true,
        humanHandoffSlack: true,
        ticketEmail: true,
        ticketSlack: true,
        leadEmail: true,
        leadSlack: false,
      }),
    privacy: jsonb("privacy")
      .$type<WorkspacePrivacyPrefs>()
      .notNull()
      .default({
        conversationRetentionDays: 365,
        allowDataExport: true,
        anonymizeVisitorIds: false,
      }),
    /** Architecture prep for future SSO — not a live IdP connector yet. */
    sso: jsonb("sso")
      .$type<WorkspaceSsoPrep>()
      .notNull()
      .default({
        enabled: false,
        provider: null,
        notes: null,
      }),
    /** Outbound webhook URL for developer integrations (server-side secret stored separately). */
    webhook_url: text("webhook_url"),
    webhook_secret_last_four: varchar("webhook_secret_last_four", {
      length: 4,
    }),
    webhook_secret_hash: text("webhook_secret_hash"),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_workspace_settings_org_uidx").on(
      t.organization_id,
    ),
  ],
);

/**
 * Human handoff / support-ticket workspace settings (one row per org).
 * Lead Agent enablement + fields live on `organization_agents` (agent_id = lead).
 */
export const organizationEngagementSettings = pgTable(
  "organization_engagement_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    human_handoff_enabled: boolean("human_handoff_enabled")
      .notNull()
      .default(true),
    /** Escalation condition flags. */
    escalation_conditions: jsonb("escalation_conditions")
      .$type<{
        explicitHumanRequest: boolean;
        repeatedUnhelpful: boolean;
        frustration: boolean;
        lowConfidence: boolean;
        businessRules: boolean;
      }>()
      .notNull()
      .default({
        explicitHumanRequest: true,
        repeatedUnhelpful: true,
        frustration: true,
        lowConfidence: true,
        businessRules: true,
      }),
    default_team: varchar("default_team", { length: 120 }).default("support"),
    /** always | business_hours | collect_contact */
    availability_mode: varchar("availability_mode", { length: 32 })
      .notNull()
      .default("collect_contact"),
    business_hours_note: text("business_hours_note").default(
      "Our team typically replies within one business day.",
    ),
    customer_handoff_message: text("customer_handoff_message").default(
      "I’ve sent your request to our team along with the conversation details. They’ll review it and get back to you as soon as possible.",
    ),
    unavailable_message: text("unavailable_message").default(
      "I’ve sent your request to our team along with the conversation details. They’ll review it and get back to you as soon as possible.",
    ),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_engagement_settings_org_uidx").on(
      t.organization_id,
    ),
  ],
);

/** Org-scoped embeddable chatbot configuration (dashboard ↔ SDK). */
export const widgetConfigs = pgTable(
  "widget_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Maps to dashboard widget config (branding, proactive, etc.). */
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("widget_configs_organization_uidx").on(t.organization_id),
  ],
);

/** Custom widget fonts uploaded by an organization (max 10 enforced in service). */
export const organizationFonts = pgTable(
  "organization_fonts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    family_name: varchar("family_name", { length: 120 }).notNull(),
    original_filename: varchar("original_filename", { length: 255 }).notNull(),
    content_type: varchar("content_type", { length: 120 }).notNull(),
    byte_size: integer("byte_size").notNull(),
    storage_key: text("storage_key").notNull(),
    /** Public CDN URL when stored on Vercel Blob (null = serve via API from disk). */
    public_url: text("public_url"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("organization_fonts_org_idx").on(t.organization_id),
  ],
);

/** Widget brand logo — max 1 per organization (enforced by unique org_id). */
export const organizationLogos = pgTable(
  "organization_logos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    original_filename: varchar("original_filename", { length: 255 }).notNull(),
    content_type: varchar("content_type", { length: 120 }).notNull(),
    byte_size: integer("byte_size").notNull(),
    storage_key: text("storage_key").notNull(),
    /** Public CDN URL when stored on Vercel Blob (null = serve via API from disk). */
    public_url: text("public_url"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_logos_org_uidx").on(t.organization_id),
  ],
);
