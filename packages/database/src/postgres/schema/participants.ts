import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Website widget participants — org-scoped contacts (identified + anonymous).
 * Distinct from dashboard accounts (`users` + `organization_accounts`) and widget participants.
 */
export const organizationParticipants = pgTable(
  "organization_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Host app user id or SDK anonymous uuid — unique per organization. */
    external_id: varchar("external_id", { length: 255 }).notNull(),
    display_name: varchar("display_name", { length: 255 })
      .notNull()
      .default("Guest"),
    email: varchar("email", { length: 254 }),
    profile_image: text("profile_image"),
    is_anonymous: boolean("is_anonymous").notNull().default(true),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_participants_org_external_uidx").on(
      t.organization_id,
      t.external_id,
    ),
  ],
);
