/**
 * Conversations dashboard — visitors → conversations → messages.
 * List payload stays light (summaries); messages load on select.
 */

export type ConversationStatus = "open" | "escalated" | "resolved";

export type InboxFilter = "all" | "escalated";

export type InboxMessageRole = "user" | "assistant" | "system" | "human";

export interface InboxMessage {
  id: string;
  role: InboxMessageRole;
  content: string;
  created_at: string;
  /** True when a human agent wrote this (stored as assistant + metadata). */
  fromHuman?: boolean;
  /** Agent that authored this assistant turn. */
  agentId?: string | null;
  agentName?: string | null;
  sources?: Array<{
    id: string;
    name: string;
    type: string;
    visibility: "public" | "private";
    publicUrl: string | null;
  }>;
}

export interface InboxThread {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  escalationReason: string | null;
  /** Last agent that spoke (not exclusive owner). */
  lastAgentId: string | null;
  lastAgentName: string | null;
  preview: string;
  latestAt: string;
  createdAt: string;
  /** Empty in list payload; filled after select. */
  messages: InboxMessage[];
}

export interface InboxUser {
  id: string;
  label: string;
  email: string | null;
  threadCount: number;
  escalatedCount: number;
  latestAt: string;
}

export interface ConversationsInboxPayload {
  users: InboxUser[];
  threads: InboxThread[];
}
