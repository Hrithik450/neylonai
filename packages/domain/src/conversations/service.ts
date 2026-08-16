import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  organizationParticipants,
  threadEscalations,
  threadMessages,
  threads,
} from "@neylonai/database";
import { ThreadMessagesService } from "../chat/thread-messages.service";
import { recordKnowledgeGapEvent } from "../engagement/knowledge-gaps";
import type { ConversationStatus, EscalateConversationInput } from "./types";
import {
  ESCALATION_CONTACT_MESSAGE,
  ESCALATION_CUSTOMER_MESSAGE,
} from "./types";
import { notifyEscalation } from "./notify-escalation";
import type { ThreadMessage } from "../chat/thread-messages.types";
import { ParticipantsService } from "../participants/participants.service";

export type ThreadEscalationRecord = {
  id: string;
  threadId: string;
  reason: string;
  createdAt: string;
};

export type ThreadEscalationSummary = {
  threadId: string;
  reasons: string[];
  escalationCount: number;
  lastEscalatedAt: string | null;
};

/**
 * Resolve organization for a thread via threads.organization_id.
 */
export async function getThreadOrganizationId(
  threadId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      organizationId: threads.organization_id,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function assertThreadBelongsToOrganization(
  threadId: string,
  organizationId: string,
): Promise<void> {
  const orgId = await getThreadOrganizationId(threadId);
  if (!orgId || orgId !== organizationId) {
    throw new Error("Thread not found");
  }
}

export async function isThreadEscalated(threadId: string): Promise<boolean> {
  const [row] = await db
    .select({
      escalated: threads.escalated,
      status: threads.conversation_status,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  return (
    row?.escalated === true ||
    row?.status === "human_pending" ||
    row?.status === "human_active"
  );
}

export async function getConversationStatus(
  threadId: string,
): Promise<ConversationStatus | null> {
  const [row] = await db
    .select({ status: threads.conversation_status })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  return (row?.status as ConversationStatus | undefined) ?? null;
}

export async function listThreadEscalations(
  threadId: string,
): Promise<ThreadEscalationRecord[]> {
  const rows = await db
    .select({
      id: threadEscalations.id,
      threadId: threadEscalations.thread_id,
      reason: threadEscalations.reason,
      createdAt: threadEscalations.created_at,
    })
    .from(threadEscalations)
    .where(eq(threadEscalations.thread_id, threadId))
    .orderBy(asc(threadEscalations.created_at));

  return rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    reason: r.reason,
    createdAt: (r.createdAt ?? new Date()).toISOString(),
  }));
}

/** Batch summaries for inbox list (reasons chronologically, count, last at). */
export async function summarizeThreadEscalations(
  threadIds: string[],
): Promise<Map<string, ThreadEscalationSummary>> {
  const out = new Map<string, ThreadEscalationSummary>();
  if (threadIds.length === 0) return out;

  const rows = await db
    .select({
      threadId: threadEscalations.thread_id,
      reason: threadEscalations.reason,
      createdAt: threadEscalations.created_at,
    })
    .from(threadEscalations)
    .where(inArray(threadEscalations.thread_id, threadIds))
    .orderBy(asc(threadEscalations.created_at));

  for (const id of threadIds) {
    out.set(id, {
      threadId: id,
      reasons: [],
      escalationCount: 0,
      lastEscalatedAt: null,
    });
  }

  for (const row of rows) {
    const summary = out.get(row.threadId);
    if (!summary) continue;
    const at = (row.createdAt ?? new Date()).toISOString();
    summary.reasons.push(row.reason);
    summary.escalationCount += 1;
    summary.lastEscalatedAt = at;
  }

  return out;
}

/**
 * Mark the thread escalated, append a reason event, and stop AI replies.
 * Always records a reason row (even if already escalated).
 */
export async function escalateConversation(
  input: EscalateConversationInput,
): Promise<{
  escalated: boolean;
  contactRequired: boolean;
  status: ConversationStatus;
  customerMessage: string;
}> {
  await assertThreadBelongsToOrganization(input.threadId, input.organizationId);

  const reason = input.reason?.trim() || "Human handoff requested";

  const [context] = await db
    .select({
      participantId: threads.participant_id,
      status: threads.conversation_status,
      displayName: organizationParticipants.display_name,
      email: organizationParticipants.email,
      anonymous: organizationParticipants.is_anonymous,
    })
    .from(threads)
    .leftJoin(
      organizationParticipants,
      eq(threads.participant_id, organizationParticipants.id),
    )
    .where(
      and(
        eq(threads.id, input.threadId),
        eq(threads.organization_id, input.organizationId),
      ),
    )
    .limit(1);
  if (!context) throw new Error("Thread not found");

  const hasContact =
    Boolean(context.email?.trim()) &&
    Boolean(context.displayName?.trim()) &&
    context.displayName !== "Guest" &&
    context.anonymous === false;
  const nextStatus: ConversationStatus = hasContact
    ? "human_pending"
    : "awaiting_contact";
  const alreadyActive =
    context.status === "human_pending" || context.status === "human_active";

  await db.transaction(async (tx) => {
    await tx
      .update(threads)
      .set({
        conversation_status: alreadyActive ? context.status : nextStatus,
        escalated: alreadyActive || hasContact,
      })
      .where(eq(threads.id, input.threadId));

    const [existing] = await tx
      .select({ id: threadEscalations.id })
      .from(threadEscalations)
      .where(
        and(
          eq(threadEscalations.thread_id, input.threadId),
          inArray(threadEscalations.status, ["awaiting_contact", "open"]),
        ),
      )
      .limit(1);

    const escalationValues = {
      reason,
      status: (hasContact ? "open" : "awaiting_contact") as
        | "open"
        | "awaiting_contact",
      activated_at: hasContact ? new Date() : null,
    };

    if (existing) {
      await tx
        .update(threadEscalations)
        .set(escalationValues)
        .where(eq(threadEscalations.id, existing.id));
    } else {
      await tx
        .insert(threadEscalations)
        .values({
          thread_id: input.threadId,
          ...escalationValues,
        })
        .onConflictDoNothing();
    }
  });

  if (hasContact && !alreadyActive) {
    void notifyEscalation({
      organizationId: input.organizationId,
      threadId: input.threadId,
      reason,
      summary: input.summary ?? null,
    });
  }

  if (input.trigger === "unhelpful" || input.trigger === "low_confidence") {
    void recordEscalationKnowledgeGap({
      organizationId: input.organizationId,
      threadId: input.threadId,
      trigger: input.trigger,
    });
  }

  return {
    escalated: hasContact || alreadyActive,
    contactRequired: !hasContact && !alreadyActive,
    status: alreadyActive ? (context.status as ConversationStatus) : nextStatus,
    customerMessage:
      hasContact || alreadyActive
        ? ESCALATION_CUSTOMER_MESSAGE
        : ESCALATION_CONTACT_MESSAGE,
  };
}

export async function submitHandoffContact(input: {
  organizationId: string;
  threadId: string;
  participantExternalId: string;
  name: string;
  email: string;
}): Promise<{
  escalated: true;
  status: "human_pending" | "human_active";
  customerMessage: string;
}> {
  const [owned] = await db
    .select({
      participantId: threads.participant_id,
      externalId: organizationParticipants.external_id,
      status: threads.conversation_status,
    })
    .from(threads)
    .innerJoin(
      organizationParticipants,
      eq(threads.participant_id, organizationParticipants.id),
    )
    .where(
      and(
        eq(threads.id, input.threadId),
        eq(threads.organization_id, input.organizationId),
        eq(organizationParticipants.external_id, input.participantExternalId),
      ),
    )
    .limit(1);
  if (!owned?.participantId) throw new Error("Conversation not found");

  const identified = await ParticipantsService.identifyParticipant({
    id: owned.participantId,
    organizationId: input.organizationId,
    name: input.name,
    email: input.email,
  });
  if (!identified.success) {
    throw new Error(identified.error ?? "Invalid contact details");
  }
  if (owned.status === "human_pending" || owned.status === "human_active") {
    return {
      escalated: true,
      status: owned.status,
      customerMessage: ESCALATION_CUSTOMER_MESSAGE,
    };
  }

  const [pending] = await db
    .select({
      id: threadEscalations.id,
      reason: threadEscalations.reason,
    })
    .from(threadEscalations)
    .where(
      and(
        eq(threadEscalations.thread_id, input.threadId),
        inArray(threadEscalations.status, ["awaiting_contact", "open"]),
      ),
    )
    .limit(1);

  const activatedNow = await db.transaction(async (tx) => {
    await tx
      .update(threads)
      .set({ conversation_status: "human_pending", escalated: true })
      .where(eq(threads.id, input.threadId));

    if (pending) {
      const [activated] = await tx
        .update(threadEscalations)
        .set({ status: "open", activated_at: new Date() })
        .where(
          and(
            eq(threadEscalations.id, pending.id),
            eq(threadEscalations.status, "awaiting_contact"),
          ),
        )
        .returning({ id: threadEscalations.id });
      return Boolean(activated);
    } else {
      const [inserted] = await tx
        .insert(threadEscalations)
        .values({
          thread_id: input.threadId,
          reason: "Human handoff requested",
          status: "open",
          activated_at: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: threadEscalations.id });
      return Boolean(inserted);
    }
  });

  if (activatedNow) {
    void notifyEscalation({
      organizationId: input.organizationId,
      threadId: input.threadId,
      reason: pending?.reason ?? "Human handoff requested",
      summary: null,
    });

    const created = await ThreadMessagesService.createMessage({
      thread_id: input.threadId,
      role: "assistant",
      content: ESCALATION_CUSTOMER_MESSAGE,
    });
    if (!created.success) {
      throw new Error(created.error ?? "Failed to confirm handoff");
    }
  }

  return {
    escalated: true,
    status: "human_pending",
    customerMessage: ESCALATION_CUSTOMER_MESSAGE,
  };
}

/**
 * Human agent reply while escalated. Stored as role=human so dashboard and
 * widget (mapped to assistant for display) can show it.
 */
export async function postHumanReply(input: {
  organizationId: string;
  threadId: string;
  content: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
}): Promise<{ escalated: boolean; message: ThreadMessage }> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Message content is required");
  }

  await assertThreadBelongsToOrganization(input.threadId, input.organizationId);

  const escalated = await isThreadEscalated(input.threadId);
  if (!escalated) {
    throw new Error("Only escalated conversations accept human replies");
  }

  const created = await ThreadMessagesService.createMessage({
    thread_id: input.threadId,
    role: "human",
    content,
  });

  if (!created.success || !created.data) {
    throw new Error(created.error ?? "Failed to save reply");
  }

  await db
    .update(threads)
    .set({ conversation_status: "human_active", escalated: true })
    .where(eq(threads.id, input.threadId));

  return {
    escalated: true,
    message: created.data,
  };
}

/** Whether the AI may reply on this thread. */
export function canAiRespond(
  state: ConversationStatus | null | undefined,
): boolean {
  return state == null || state === "ai_active" || state === "resolved";
}

async function recordEscalationKnowledgeGap(input: {
  organizationId: string;
  threadId: string;
  trigger: "unhelpful" | "low_confidence";
}): Promise<void> {
  try {
    const [latestUser] = await db
      .select({
        id: threadMessages.id,
        content: threadMessages.content,
        pagePath: threadMessages.page_path,
      })
      .from(threadMessages)
      .where(
        and(
          eq(threadMessages.thread_id, input.threadId),
          eq(threadMessages.role, "user"),
        ),
      )
      .orderBy(desc(threadMessages.created_at))
      .limit(1);

    if (!latestUser?.content?.trim()) return;

    await recordKnowledgeGapEvent({
      organizationId: input.organizationId,
      gapType:
        input.trigger === "low_confidence"
          ? "low_confidence_escalation"
          : "unhelpful_escalation",
      sampleQuestion: latestUser.content,
      messageId: latestUser.id,
      threadId: input.threadId,
      pagePath: latestUser.pagePath,
    });
  } catch (error) {
    console.warn(
      "[escalateConversation] knowledge gap record failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
