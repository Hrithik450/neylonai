import { pgTable, uuid, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

/** Dashboard accounts (Google OAuth). Widget participants live in `organization_participants`. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  google_id: varchar("google_id", { length: 255 }).unique(),
  username: varchar("username", { length: 150 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  profile_image: text("profile_image"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  has_been_onboarded: boolean("has_been_onboarded").notNull().default(false),
  onboarding_step: integer("onboarding_step").notNull().default(1),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
