import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Anonymous widget visitors — separate from dashboard accounts (`users`).
 * Deleting or anonymizing a visitor does not cascade-delete threads (SET NULL).
 */
export const visitors = pgTable(
  "visitors",
  {
    id: uuid("id").primaryKey(),
    display_name: varchar("display_name", { length: 150 })
      .notNull()
      .default("Guest"),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("visitors_created_at_idx").on(t.created_at)],
);
