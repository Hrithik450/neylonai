import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  uuid,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const account = pgTable(
  "account",
  {
    userId: uuid("userId").notNull(),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_userId_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const session = pgTable(
  "session",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: uuid("userId").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_userId_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const threadMessages = pgTable(
  "thread_messages",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    threadId: uuid("thread_id").notNull(),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    file_url: text("file_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [thread.id],
      name: "thread_messages_thread_id_thread_id_fk",
    }).onDelete("cascade"),
  ]
);

export const thread = pgTable(
  "thread",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    user_id: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [user.id],
      name: "thread_user_id_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const roleEnum = pgEnum("role", [
  "student",
  "business_owner",
  "explorer",
  "admin",
]);
export const assistantEnum = pgEnum("assistant", [
  "internal_assistant",
  "customer_service_assistant",
  "resume_assistant",
]);

export const user = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: text("name"),
    email: text("email"),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dailyLimit: integer("daily_limit").default(200).notNull(),
    resumeGenerationLimit: integer("resume_generation_limit")
      .default(2)
      .notNull(),
    role: roleEnum("role").default("explorer").notNull(),
    assistant: assistantEnum("assistant")
      .default("internal_assistant")
      .notNull(),
  },
  (table) => [unique("user_email_unique").on(table.email)]
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    user_id: uuid("user_id").notNull(),
    user_name: text("user_name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [user.id],
      name: "feedback_user_id_user_id_fk",
    }).onDelete("cascade"),
  ]
);
