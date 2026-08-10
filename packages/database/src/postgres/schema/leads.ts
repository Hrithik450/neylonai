import { pgTable, uuid, text, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  organization_id: uuid("organization_id"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  budget: text("budget"),
  timeline: text("timeline"),
  thread_id: uuid("thread_id"),
  /** new | contacted | qualified | synced | archived */
  status: varchar("status", { length: 32 }).default("new"),
  /** Agent that captured the lead (e.g. "lead"). */
  source_agent_id: varchar("source_agent_id", { length: 64 }),
  /** pending | synced | failed | not_configured */
  crm_sync_status: varchar("crm_sync_status", { length: 32 }).default(
    "not_configured",
  ),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("leads_organization_id_idx").on(t.organization_id),
  index("leads_thread_id_idx").on(t.thread_id),
]);
