import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

/** Dashboard accounts (Google OAuth). Widget visitors live in `visitors`. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  google_id: varchar("google_id", { length: 255 }).unique(),
  username: varchar("username", { length: 150 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  first_name: varchar("first_name", { length: 150 }).notNull().default(""),
  profile_image: text("profile_image"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
