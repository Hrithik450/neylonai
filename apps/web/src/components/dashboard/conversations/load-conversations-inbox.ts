import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@neylonai/database";
import { summarizeThreadEscalations } from "@neylonai/domain/conversations";
import {
  aggregateKnowledgeGaps,
  loadCitationsForMessages,
} from "@neylonai/domain/engagement";
import type { OrgSession } from "@/server/auth-guards";
import type {
  ConversationsInboxPayload,
  InboxThread,
  InboxUser,
  KnowledgeGapInboxRow,
} from "./inbox-types";

function participantLabel(input: {
  displayName?: string | null;
  email?: string | null;
  isAnonymous?: boolean | null;
}): string {
  const name = input.displayName?.trim();
  if (name && name !== "Guest") return name;
  const email = input.email?.trim();
  if (email) return email;
  return input.isAnonymous ? "anonymous visitor" : "visitor";
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Inbox list only — no full message bodies.
 * Last-message preview is one DISTINCT ON query for all threads.
 */
export async function loadConversationsInbox(
  member: OrgSession,
): Promise<ConversationsInboxPayload> {
  try {
    const threadRows = await db
      .select({
        id: schema.threads.id,
        title: schema.threads.title,
        escalated: schema.threads.escalated,
        conversationStatus: schema.threads.conversation_status,
        participantId: schema.threads.participant_id,
        created_at: schema.threads.created_at,
      })
      .from(schema.threads)
      .where(eq(schema.threads.organization_id, member.organizationId))
      .orderBy(desc(schema.threads.created_at))
      .limit(500);

    if (threadRows.length === 0) {
      return { users: [], threads: [], knowledgeGaps: [] };
    }

    const threadIds = threadRows.map((t) => t.id);

    const participantIds = [
      ...new Set(threadRows.map((t) => t.participantId).filter(Boolean)),
    ] as string[];
    const participantRows =
      participantIds.length > 0
        ? await db
            .select({
              id: schema.organizationParticipants.id,
              externalId: schema.organizationParticipants.external_id,
              displayName: schema.organizationParticipants.display_name,
              email: schema.organizationParticipants.email,
              isAnonymous: schema.organizationParticipants.is_anonymous,
            })
            .from(schema.organizationParticipants)
            .where(
              inArray(schema.organizationParticipants.id, participantIds),
            )
        : [];
    const participantById = new Map(
      participantRows.map((p) => [p.id, p] as const),
    );

    type PreviewRow = {
      thread_id: string;
      content: string;
      created_at: Date | string | null;
    };

    const previewResult =
      threadIds.length > 0
        ? await db.execute<PreviewRow>(sql`
            SELECT DISTINCT ON (thread_id)
              thread_id,
              content,
              created_at
            FROM thread_messages
            WHERE thread_id IN (${sql.join(
              threadIds.map((id) => sql`${id}`),
              sql`, `,
            )})
            ORDER BY thread_id, created_at DESC
          `)
        : null;

    const previewList: PreviewRow[] = Array.isArray(previewResult)
      ? previewResult
      : ((previewResult as { rows?: PreviewRow[] } | null)?.rows ?? []);

    const previewByThread = new Map(
      previewList.map((r) => [
        r.thread_id,
        {
          content: r.content ?? "",
          createdAt: toIso(r.created_at),
        },
      ]),
    );

    const escalationByThread = await summarizeThreadEscalations(threadIds);

    const threads: InboxThread[] = [];

    for (const thread of threadRows) {
      const participantId = thread.participantId ?? "";
      const preview = previewByThread.get(thread.id);
      const createdAt = (thread.created_at ?? new Date()).toISOString();
      const latestAt = preview?.createdAt ?? createdAt;
      const escalation = escalationByThread.get(thread.id);

      threads.push({
        id: thread.id,
        userId: participantId,
        title: thread.title || "Conversation",
        escalated: thread.escalated === true,
        conversationStatus: thread.conversationStatus ?? "ai_active",
        escalationReasons: escalation?.reasons ?? [],
        escalationCount: escalation?.escalationCount ?? 0,
        lastEscalatedAt: escalation?.lastEscalatedAt ?? null,
        preview: (preview?.content ?? thread.title ?? "").slice(0, 140),
        latestAt,
        createdAt,
        messages: [],
      });
    }

    threads.sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));

    const byParticipant = new Map<string, InboxThread[]>();
    for (const t of threads) {
      if (!t.userId) continue;
      const list = byParticipant.get(t.userId) ?? [];
      list.push(t);
      byParticipant.set(t.userId, list);
    }

    const users: InboxUser[] = [...byParticipant.entries()]
      .map(([participantId, userThreads]) => {
        const p = participantById.get(participantId);
        const latestAt = userThreads.reduce(
          (max, t) => (t.latestAt > max ? t.latestAt : max),
          userThreads[0]?.latestAt ?? new Date(0).toISOString(),
        );
        return {
          id: participantId,
          externalId: p?.externalId ?? null,
          label: participantLabel({
            displayName: p?.displayName,
            email: p?.email,
            isAnonymous: p?.isAnonymous,
          }),
          email: p?.email?.trim() || null,
          threadCount: userThreads.length,
          escalatedCount: userThreads.filter((t) => t.escalated).length,
          latestAt,
        };
      })
      .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));

    return {
      users,
      threads,
      knowledgeGaps: await loadKnowledgeGapsForInbox(member.organizationId),
    };
  } catch (error) {
    console.error("[loadConversationsInbox]", error);
    return { users: [], threads: [], knowledgeGaps: [] };
  }
}

export async function loadKnowledgeGapsForInbox(
  organizationId: string,
): Promise<KnowledgeGapInboxRow[]> {
  const rows = await aggregateKnowledgeGaps(organizationId, {
    windowDays: 30,
    limit: 100,
  });
  return rows.map((row) => ({
    questionHash: row.questionHash,
    pagePath: row.pagePath,
    sampleQuestion: row.sampleQuestion,
    count: row.count,
    gapTypes: row.gapTypes,
    latestAt: row.latestAt,
    threadId: row.threadId,
    messageId: row.messageId,
  }));
}

export async function loadConversationMessages(
  organizationId: string,
  threadId: string,
): Promise<InboxThread["messages"] | null> {
  const [owned] = await db
    .select({
      organizationId: schema.threads.organization_id,
    })
    .from(schema.threads)
    .where(eq(schema.threads.id, threadId))
    .limit(1);

  if (!owned || owned.organizationId !== organizationId) {
    return null;
  }

  const msgs = await db
    .select({
      id: schema.threadMessages.id,
      role: schema.threadMessages.role,
      content: schema.threadMessages.content,
      created_at: schema.threadMessages.created_at,
    })
    .from(schema.threadMessages)
    .where(eq(schema.threadMessages.thread_id, threadId))
    .orderBy(asc(schema.threadMessages.created_at))
    .limit(500);

  const assistantIds = msgs
    .filter((m) => m.role === "assistant")
    .map((m) => m.id);
  const citationsByMessage = await loadCitationsForMessages(
    organizationId,
    assistantIds,
  );

  return msgs.map((m) => {
    const role: InboxThread["messages"][number]["role"] =
      m.role === "assistant" || m.role === "system" || m.role === "human"
        ? m.role
        : "user";
    return {
      id: m.id,
      role,
      content: m.content,
      created_at: (m.created_at ?? new Date()).toISOString(),
      citations:
        m.role === "assistant"
          ? citationsByMessage.get(m.id) ?? []
          : undefined,
    };
  });
}
