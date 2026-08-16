import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
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
    blocked_at: timestamp("blocked_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("organizations_slug_uidx").on(t.slug)],
);

/** Neylon dashboard account ↔ organization (org owner / operator). */
export const organizationAccounts = pgTable(
  "organization_accounts",
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
    uniqueIndex("organization_accounts_org_user_uidx").on(
      t.organization_id,
      t.user_id,
    ),
    uniqueIndex("organization_accounts_user_uidx").on(t.user_id),
  ],
);

export type OrganizationPrivacyPrefs = {
  conversationRetentionDays: number | null;
};

/**
 * Org-scoped account settings (General, Privacy).
 * Feature config (widget, agents, knowledge, CRM) stays in those products.
 */
export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    privacy: jsonb("privacy")
      .$type<OrganizationPrivacyPrefs>()
      .notNull()
      .default({
        conversationRetentionDays: 365,
      }),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_settings_org_uidx").on(t.organization_id),
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
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_logos_org_uidx").on(t.organization_id),
  ],
);
