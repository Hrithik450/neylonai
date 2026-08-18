import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Per-visitor, per-section suggestion progress.
 * Lets the suggestions API return only unshown prompts when a visitor returns.
 */
export const visitorSuggestionState = pgTable(
  "visitor_suggestion_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    visitor_id: varchar("visitor_id", { length: 128 }).notNull(),
    page_path: varchar("page_path", { length: 512 }).notNull(),
    section_key: varchar("section_key", { length: 96 }).notNull(),
    shown_suggestion_ids: jsonb("shown_suggestion_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    pending_suggestion_ids: jsonb("pending_suggestion_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    total_suggestions_for_section: integer(
      "total_suggestions_for_section",
    ).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("visitor_suggestion_state_uidx").on(
      t.organization_id,
      t.visitor_id,
      t.page_path,
      t.section_key,
    ),
    index("visitor_suggestion_state_org_visitor_idx").on(
      t.organization_id,
      t.visitor_id,
    ),
  ],
);
