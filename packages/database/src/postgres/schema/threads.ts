import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { visitors } from "./visitors";

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitor_id: uuid("visitor_id").references(() => visitors.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("threads_visitor_id_idx").on(t.visitor_id)],
);

export const threadMessages = pgTable(
  "thread_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    thread_id: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /**
     * Agent that produced this assistant turn (null for user / human / system).
     * Threads are shared context — multiple agents may author turns over time.
     */
    agent_id: varchar("agent_id", { length: 64 }),
    /** Dashboard-only fields (e.g. provenance). Never send raw to public widget. */
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("thread_messages_thread_id_idx").on(t.thread_id),
    index("thread_messages_thread_id_created_at_idx").on(
      t.thread_id,
      t.created_at,
    ),
    index("thread_messages_agent_id_idx").on(t.agent_id),
  ],
);

export const threadRelations = relations(threads, ({ one, many }) => ({
  visitor: one(visitors, {
    fields: [threads.visitor_id],
    references: [visitors.id],
  }),
  messages: many(threadMessages),
}));

export const threadMessageRelations = relations(threadMessages, ({ one }) => ({
  thread: one(threads, {
    fields: [threadMessages.thread_id],
    references: [threads.id],
  }),
}));
