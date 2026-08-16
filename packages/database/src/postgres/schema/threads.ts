import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { organizationParticipants } from "./participants";

export const CONVERSATION_STATUSES = [
  "ai_active",
  "awaiting_contact",
  "human_pending",
  "human_active",
  "resolved",
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Tenant owner — denormalized for org-scoped queries / retention / RLS. */
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    participant_id: uuid("participant_id").references(
      () => organizationParticipants.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 255 }).notNull(),
    /** When true, AI must not reply; dashboard human composer is available. */
    escalated: boolean("escalated").notNull().default(false),
    /** Canonical lifecycle state. `escalated` remains as a compatibility read model. */
    conversation_status: varchar("conversation_status", { length: 32 })
      .$type<ConversationStatus>()
      .notNull()
      .default("ai_active"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("threads_organization_id_idx").on(t.organization_id),
    index("threads_org_created_at_idx").on(t.organization_id, t.created_at),
    index("threads_participant_id_idx").on(t.participant_id),
    index("threads_escalated_idx").on(t.escalated),
    index("threads_org_conversation_status_idx").on(
      t.organization_id,
      t.conversation_status,
    ),
  ],
);

/**
 * One row per escalation event. Reasons stay here — not denormalized on threads.
 * Count / lastEscalatedAt are derived from this table.
 */
export const threadEscalations = pgTable(
  "thread_escalations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    thread_id: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    /** Agent-provided short reason for this escalation. */
    reason: text("reason").notNull(),
    status: varchar("status", { length: 32 })
      .$type<"awaiting_contact" | "open" | "resolved">()
      .notNull()
      .default("open"),
    activated_at: timestamp("activated_at", { withTimezone: true }),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("thread_escalations_thread_id_idx").on(t.thread_id),
    index("thread_escalations_thread_id_created_at_idx").on(
      t.thread_id,
      t.created_at,
    ),
    index("thread_escalations_thread_status_idx").on(t.thread_id, t.status),
    uniqueIndex("thread_escalations_one_active_uidx")
      .on(t.thread_id)
      .where(sql`${t.status} IN ('awaiting_contact', 'open')`),
  ],
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
    in_reply_to_message_id: uuid("in_reply_to_message_id").references(
      (): AnyPgColumn => threadMessages.id,
      { onDelete: "set null" },
    ),
    page_path: text("page_path"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("thread_messages_thread_id_idx").on(t.thread_id),
    index("thread_messages_thread_id_created_at_idx").on(
      t.thread_id,
      t.created_at,
    ),
    index("thread_messages_in_reply_to_idx").on(t.in_reply_to_message_id),
  ],
);

export const messageFeedback = pgTable(
  "message_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    message_id: uuid("message_id")
      .notNull()
      .references(() => threadMessages.id, { onDelete: "cascade" }),
    participant_id: uuid("participant_id")
      .notNull()
      .references(() => organizationParticipants.id, { onDelete: "cascade" }),
    helpful: boolean("helpful").notNull(),
    comment: text("comment"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("message_feedback_message_participant_uidx").on(
      t.message_id,
      t.participant_id,
    ),
    index("message_feedback_org_created_idx").on(
      t.organization_id,
      t.created_at,
    ),
    index("message_feedback_org_helpful_idx").on(
      t.organization_id,
      t.helpful,
    ),
  ],
);

export const threadRelations = relations(threads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [threads.organization_id],
    references: [organizations.id],
  }),
  participant: one(organizationParticipants, {
    fields: [threads.participant_id],
    references: [organizationParticipants.id],
  }),
  messages: many(threadMessages),
  escalations: many(threadEscalations),
}));

export const threadEscalationRelations = relations(
  threadEscalations,
  ({ one }) => ({
    thread: one(threads, {
      fields: [threadEscalations.thread_id],
      references: [threads.id],
    }),
  }),
);

export const threadMessageRelations = relations(threadMessages, ({ one }) => ({
  thread: one(threads, {
    fields: [threadMessages.thread_id],
    references: [threads.id],
  }),
}));
