import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  google_id: varchar("google_id", { length: 255 }).unique(),
  username: varchar("username", { length: 150 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  first_name: varchar("first_name", { length: 150 }).notNull().default(""),
  profile_image: text("profile_image"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  daily_limit: integer("daily_limit").notNull().default(200),
  resume_generation_limit: integer("resume_generation_limit").notNull().default(2),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const threads = pgTable("thread", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const threadMessages = pgTable("thread_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  thread_id: uuid("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  user_name: text("user_name").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  feedback: many(feedback),
}));

export const threadRelations = relations(threads, ({ one, many }) => ({
  user: one(users, { fields: [threads.user_id], references: [users.id] }),
  messages: many(threadMessages),
}));

export const threadMessageRelations = relations(threadMessages, ({ one }) => ({
  thread: one(threads, {
    fields: [threadMessages.thread_id],
    references: [threads.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, { fields: [feedback.user_id], references: [users.id] }),
}));

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  budget: text("budget"),
  timeline: text("timeline"),
  thread_id: uuid("thread_id"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
