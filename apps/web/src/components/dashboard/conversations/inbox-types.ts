/**
 * Conversations dashboard — visitors → conversations → messages.
 * List payload stays light (summaries); messages load on select.
 */

export type InboxFilter = "all" | "escalated" | "knowledge_gaps";

export type InboxMessageRole = "user" | "assistant" | "system" | "human";

export interface InboxCitation {
  chunkId: string;
  documentId: string;
  sourceId: string | null;
  documentName: string | null;
  sourceLabel: string | null;
  sourceType: string | null;
  score: number | null;
  rank: number;
}

export interface InboxMessage {
  id: string;
  role: InboxMessageRole;
  content: string;
  created_at: string;
  citations?: InboxCitation[];
}

export interface InboxThread {
  id: string;
  userId: string;
  title: string;
  escalated: boolean;
  conversationStatus:
    | "ai_active"
    | "awaiting_contact"
    | "human_pending"
    | "human_active"
    | "resolved";
  /** Chronological escalation reasons from thread_escalations. */
  escalationReasons: string[];
  escalationCount: number;
  lastEscalatedAt: string | null;
  preview: string;
  latestAt: string;
  createdAt: string;
  /** Empty in list payload; filled after select. */
  messages: InboxMessage[];
}

export interface InboxUser {
  /** Internal organization_participants.id */
  id: string;
  /** Host app user id or anonymous uuid */
  externalId: string | null;
  label: string;
  email: string | null;
  threadCount: number;
  escalatedCount: number;
  latestAt: string;
}

export interface ConversationsInboxPayload {
  users: InboxUser[];
  threads: InboxThread[];
  knowledgeGaps: KnowledgeGapInboxRow[];
}

export interface KnowledgeGapInboxRow {
  questionHash: string;
  pagePath: string | null;
  sampleQuestion: string;
  count: number;
  gapTypes: string[];
  latestAt: string;
  threadId: string | null;
  messageId: string | null;
}
