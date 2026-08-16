import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Org-installed integrations.
 * - integration_id: catalog id from the code registry
 * - enabled: true = on, false = turned off (row kept for config)
 * - no row = never integrated
 * - config: non-secret metadata only (urls for public sites, labels, sync timestamps).
 *   Secrets (connection URLs, OAuth tokens) live in organization_integration_secrets.
 *
 * Catalog listing / connectable / coming-soon lives in @neylonai/integrations (code).
 */
export const organizationIntegrations = pgTable(
  "organization_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Catalog id from code registry — not an FK. */
    integration_id: varchar("integration_id", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    /** Non-secret connection metadata (host labels, public website url, etc.). */
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_integrations_org_integration_uidx").on(
      t.organization_id,
      t.integration_id,
    ),
  ],
);

/**
 * Encrypted credentials for an installed integration.
 * One row per (organization_integration_id, secret_key).
 */
export const organizationIntegrationSecrets = pgTable(
  "organization_integration_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_integration_id: uuid("organization_integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    /** Catalog credential key, e.g. connectionUrl, access_token. */
    secret_key: varchar("secret_key", { length: 64 }).notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    auth_tag: text("auth_tag").notNull(),
    key_version: integer("key_version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_integration_secrets_integration_key_uidx").on(
      t.organization_integration_id,
      t.secret_key,
    ),
  ],
);
