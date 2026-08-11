import { eq } from "drizzle-orm";
import {
  db,
  conversationStates,
  organizationEngagementSettings,
} from "@neylonai/database";
import { ThreadMessagesService } from "../chat/thread-messages.service";
import type {
  ConversationLifecycleStatus,
  ConversationStateRecord,
  EscalateConversationInput,
  EngagementSettings,
} from "./types";
import { DEFAULT_ENGAGEMENT_SETTINGS } from "./types";
import { notifyEscalation } from "./notify-escalation";
import type { ThreadMessage } from "../chat/thread-messages.types";

function normalizeStatus(raw: string): ConversationLifecycleStatus {
  if (raw === "escalated") return "escalated";
  if (raw === "resolved") return "resolved";
  // Legacy: ai_active | waiting | human_active → open
  return "open";
}

function mapState(
  row: typeof conversationStates.$inferSelect,
): ConversationStateRecord {
  const status = normalizeStatus(row.status);
  return {
    id: row.id,
    organizationId: row.organization_id,
    threadId: row.thread_id,
    status,
    assignedAgentId: row.assigned_agent_id,
    escalationReason: row.escalation_reason,
    escalatedAt: row.escalated_at?.toISOString() ?? null,
    aiPaused: status !== "open",
    updatedAt: row.updated_at?.toISOString() ?? null,
    createdAt: row.created_at?.toISOString() ?? null,
  };
}

function mapSettings(
  row: typeof organizationEngagementSettings.$inferSelect,
): EngagementSettings {
  return {
    organizationId: row.organization_id,
    humanHandoffEnabled: row.human_handoff_enabled,
    escalationConditions: {
      ...DEFAULT_ENGAGEMENT_SETTINGS.escalationConditions,
      ...(row.escalation_conditions ?? {}),
    },
    defaultTeam: row.default_team ?? "support",
    availabilityMode: (row.availability_mode ??
      "collect_contact") as EngagementSettings["availabilityMode"],
    businessHoursNote:
      row.business_hours_note ?? DEFAULT_ENGAGEMENT_SETTINGS.businessHoursNote,
    customerHandoffMessage:
      row.customer_handoff_message ??
      DEFAULT_ENGAGEMENT_SETTINGS.customerHandoffMessage,
    unavailableMessage:
      row.unavailable_message ?? DEFAULT_ENGAGEMENT_SETTINGS.unavailableMessage,
  };
}

export async function getEngagementSettings(
  organizationId: string,
): Promise<EngagementSettings> {
  try {
    const [row] = await db
      .select()
      .from(organizationEngagementSettings)
      .where(eq(organizationEngagementSettings.organization_id, organizationId))
      .limit(1);
    if (row) return mapSettings(row);

    const [created] = await db
      .insert(organizationEngagementSettings)
      .values({ organization_id: organizationId })
      .returning();
    if (!created) {
      throw new Error("Failed to create engagement settings");
    }
    return mapSettings(created);
  } catch (error) {
    console.error("[getEngagementSettings]", error);
    return { organizationId, ...DEFAULT_ENGAGEMENT_SETTINGS };
  }
}

export async function saveEngagementSettings(
  organizationId: string,
  patch: Partial<Omit<EngagementSettings, "organizationId">>,
): Promise<EngagementSettings> {
  const current = await getEngagementSettings(organizationId);
  const next = { ...current, ...patch, organizationId };

  const [existing] = await db
    .select({ id: organizationEngagementSettings.id })
    .from(organizationEngagementSettings)
    .where(eq(organizationEngagementSettings.organization_id, organizationId))
    .limit(1);

  const values = {
    human_handoff_enabled: next.humanHandoffEnabled,
    escalation_conditions: next.escalationConditions,
    default_team: next.defaultTeam,
    availability_mode: next.availabilityMode,
    business_hours_note: next.businessHoursNote,
    customer_handoff_message: next.customerHandoffMessage,
    unavailable_message: next.unavailableMessage,
    updated_at: new Date(),
  };

  if (existing) {
    await db
      .update(organizationEngagementSettings)
      .set(values)
      .where(eq(organizationEngagementSettings.id, existing.id));
  } else {
    await db.insert(organizationEngagementSettings).values({
      organization_id: organizationId,
      ...values,
    });
  }

  return next;
}

export async function getConversationStateByThread(
  threadId: string,
): Promise<ConversationStateRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(conversationStates)
      .where(eq(conversationStates.thread_id, threadId))
      .limit(1);
    return row ? mapState(row) : null;
  } catch {
    return null;
  }
}

export async function ensureConversationState(input: {
  organizationId: string;
  threadId: string;
  assignedAgentId?: string | null;
}): Promise<ConversationStateRecord> {
  const existing = await getConversationStateByThread(input.threadId);
  if (existing) {
    if (existing.organizationId !== input.organizationId) {
      throw new Error("Thread does not belong to this organization");
    }
    return existing;
  }

  const [row] = await db
    .insert(conversationStates)
    .values({
      organization_id: input.organizationId,
      thread_id: input.threadId,
      status: "open",
      assigned_agent_id: input.assignedAgentId ?? "neylonai-chatbot",
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create conversation state");
  }

  return mapState(row);
}

/**
 * Escalate for team follow-up. AI pauses until returned or resolved.
 */
export async function escalateConversation(
  input: EscalateConversationInput,
): Promise<{
  state: ConversationStateRecord;
  customerMessage: string;
  reference: string;
}> {
  const settings = await getEngagementSettings(input.organizationId);

  await ensureConversationState({
    organizationId: input.organizationId,
    threadId: input.threadId,
    assignedAgentId: input.escalatedByAgentId,
  });

  const assignedTeam = input.assignedTeam ?? settings.defaultTeam;
  const reference = formatEscalationReference(input.threadId);

  const [row] = await db
    .update(conversationStates)
    .set({
      status: "escalated",
      escalation_reason: input.reason,
      escalated_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(conversationStates.thread_id, input.threadId))
    .returning();

  if (!row) {
    throw new Error("Failed to escalate conversation");
  }

  let customerMessage =
    settings.customerHandoffMessage?.trim() ||
    DEFAULT_ENGAGEMENT_SETTINGS.customerHandoffMessage;

  if (
    settings.availabilityMode === "business_hours" &&
    settings.businessHoursNote?.trim()
  ) {
    customerMessage = `${customerMessage}\n\n${settings.businessHoursNote.trim()}`;
  }

  customerMessage = `${customerMessage}\n\nReference: ${reference}`;

  void notifyEscalation({
    organizationId: input.organizationId,
    reference,
    threadId: input.threadId,
    reason: input.reason,
    assignedTeam,
    summary: input.summary ?? null,
  });

  return {
    state: mapState(row),
    customerMessage,
    reference,
  };
}

function formatEscalationReference(threadId: string): string {
  return threadId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function resolveConversation(input: {
  organizationId: string;
  threadId: string;
  actor?: string | null;
}): Promise<ConversationStateRecord> {
  await ensureConversationState({
    organizationId: input.organizationId,
    threadId: input.threadId,
  });

  const [row] = await db
    .update(conversationStates)
    .set({
      status: "resolved",
      updated_at: new Date(),
    })
    .where(eq(conversationStates.thread_id, input.threadId))
    .returning();

  return mapState(row!);
}

/**
 * Close human handling and hand the same thread back to the AI
 * (Intercom/Zendesk-style handback). Widget may continue on this thread.
 */
export async function returnToAi(input: {
  organizationId: string;
  threadId: string;
  actor?: string | null;
}): Promise<ConversationStateRecord> {
  await ensureConversationState({
    organizationId: input.organizationId,
    threadId: input.threadId,
  });

  const [row] = await db
    .update(conversationStates)
    .set({
      status: "open",
      escalation_reason: null,
      escalated_at: null,
      updated_at: new Date(),
    })
    .where(eq(conversationStates.thread_id, input.threadId))
    .returning();

  return mapState(row!);
}

/**
 * Record the last agent that authored a turn on this shared thread.
 * Does not transfer exclusive ownership — threads stay multi-agent.
 */
export async function recordLastAgent(input: {
  threadId: string;
  agentId: string;
}): Promise<void> {
  await db
    .update(conversationStates)
    .set({
      assigned_agent_id: input.agentId,
      updated_at: new Date(),
    })
    .where(eq(conversationStates.thread_id, input.threadId));
}

/**
 * Human agent reply while escalated. Stored as assistant + human metadata so
 * the widget shows it and the AI can continue with full context after handback.
 */
export async function postHumanReply(input: {
  organizationId: string;
  threadId: string;
  content: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
}): Promise<{ state: ConversationStateRecord; message: ThreadMessage }> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Message content is required");
  }

  const state = await getConversationStateByThread(input.threadId);
  if (!state || state.organizationId !== input.organizationId) {
    throw new Error("Conversation not found");
  }
  if (state.status !== "escalated") {
    throw new Error("Only escalated conversations accept human replies");
  }

  const created = await ThreadMessagesService.createMessage({
    thread_id: input.threadId,
    role: "assistant",
    content,
    metadata: {
      source: "human_agent",
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      actor_name: input.actorName ?? null,
    },
  });

  if (!created.success || !created.data) {
    throw new Error(created.error ?? "Failed to save reply");
  }

  const [row] = await db
    .update(conversationStates)
    .set({ updated_at: new Date() })
    .where(eq(conversationStates.thread_id, input.threadId))
    .returning();

  return {
    state: row ? mapState(row) : state,
    message: created.data,
  };
}

/** Whether the AI may reply on this thread. */
export function canAiRespond(
  state: ConversationStateRecord | null | undefined,
): boolean {
  if (!state) return true;
  return state.status === "open";
}
