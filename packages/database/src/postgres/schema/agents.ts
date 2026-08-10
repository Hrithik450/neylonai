import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/** Org-enabled agents (catalog is code; enablement is data). */
export const organizationAgents = pgTable(
  "organization_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agent_id: varchar("agent_id", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_agents_org_agent_uidx").on(
      t.organization_id,
      t.agent_id,
    ),
  ],
);
