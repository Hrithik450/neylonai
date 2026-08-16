/**
 * Org agent state only. Catalog / tools live in the code registry (@neylonai/agent).
 * Main vs specialized is derived from the code registry (role / MAIN_AGENT_KEY), not a DB column.
 */

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

/**
 * Per-org agent connection state.
 * - main-agent: always present after onboarding
 */
export const organizationAgents = pgTable(
  "organization_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Code registry AgentDefinition.id; currently always "main-agent". */
    agent_key: varchar("agent_key", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_agents_org_agent_key_uidx").on(
      t.organization_id,
      t.agent_key,
    ),
  ],
);
