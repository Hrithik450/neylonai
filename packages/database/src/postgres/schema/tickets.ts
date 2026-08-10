import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Org-scoped conversation status for a thread.
 * Status: open (AI may reply) | escalated (needs human follow-up) | resolved
 */
export const conversationStates = pgTable(
  "conversation_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    thread_id: uuid("thread_id").notNull(),
    /** open | escalated | resolved */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    /** Last agent that authored a turn (not exclusive thread owner). */
    assigned_agent_id: varchar("assigned_agent_id", { length: 64 }),
    escalation_reason: text("escalation_reason"),
    escalated_at: timestamp("escalated_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("conversation_states_thread_uidx").on(t.thread_id),
    index("conversation_states_org_status_idx").on(t.organization_id, t.status),
  ],
);
