import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getAgentManifest } from "@neylonai/agent";
import { db, conversationStates, schema } from "@neylonai/database";
import type { OrgSession } from "@/server/auth-guards";
import type {
  ConversationStatus,
  ConversationsInboxPayload,
  InboxThread,
  InboxUser,
} from "./inbox-types";

function normalizeStatus(raw: string): ConversationStatus {
  if (raw === "escalated") return "escalated";
  if (raw === "resolved") return "resolved";
  return "open";
}

function visitorLabel(displayName?: string | null): string {
  const name = displayName?.trim();
  if (name && name !== "Guest") return name;
  return "anonymous visitor";
}

function agentDisplayName(agentId: string | null): string {
  if (!agentId) return "Agent";
  const manifest = getAgentManifest(agentId);
  return manifest?.name?.trim() || agentId;
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
    const states = await db
      .select({
        threadId: conversationStates.thread_id,
        status: conversationStates.status,
        escalationReason: conversationStates.escalation_reason,
        assignedAgentId: conversationStates.assigned_agent_id,
        updatedAt: conversationStates.updated_at,
        createdAt: conversationStates.created_at,
      })
      .from(conversationStates)
      .where(eq(conversationStates.organization_id, member.organizationId))
      .orderBy(desc(conversationStates.updated_at))
      .limit(500);

    if (states.length === 0) {
      return { users: [], threads: [] };
    }

    const threadIds = states.map((s) => s.threadId);
    const threadRows = await db
      .select({
        id: schema.threads.id,
        title: schema.threads.title,
        visitorId: schema.threads.visitor_id,
        created_at: schema.threads.created_at,
      })
      .from(schema.threads)
      .where(inArray(schema.threads.id, threadIds));
    const threadById = new Map(threadRows.map((t) => [t.id, t] as const));

    const visitorIds = [
      ...new Set(threadRows.map((t) => t.visitorId).filter(Boolean)),
    ] as string[];
    const visitorRows =
      visitorIds.length > 0
        ? await db
            .select({
              id: schema.visitors.id,
              displayName: schema.visitors.display_name,
            })
            .from(schema.visitors)
            .where(inArray(schema.visitors.id, visitorIds))
        : [];
    const visitorById = new Map(visitorRows.map((v) => [v.id, v] as const));

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

    const threads: InboxThread[] = [];

    for (const state of states) {
      const thread = threadById.get(state.threadId);
      if (!thread) continue;

      const visitorId = thread.visitorId ?? "";
      const preview = previewByThread.get(state.threadId);
      const createdAt = (
        thread.created_at ??
        state.createdAt ??
        new Date()
      ).toISOString();
      const latestAt =
        preview?.createdAt ??
        (state.updatedAt ?? state.createdAt ?? new Date()).toISOString();
      const agentId = state.assignedAgentId ?? null;

      threads.push({
        id: state.threadId,
        userId: visitorId,
        title: thread.title || "Conversation",
        status: normalizeStatus(state.status),
        escalationReason: state.escalationReason,
        lastAgentId: agentId,
        lastAgentName: agentId ? agentDisplayName(agentId) : null,
        preview: (preview?.content ?? thread.title ?? "").slice(0, 140),
        latestAt,
        createdAt,
        messages: [],
      });
    }

    const byVisitor = new Map<string, InboxThread[]>();
    for (const t of threads) {
      if (!t.userId) continue;
      const list = byVisitor.get(t.userId) ?? [];
      list.push(t);
      byVisitor.set(t.userId, list);
    }

    const users: InboxUser[] = [...byVisitor.entries()]
      .map(([userId, userThreads]) => {
        const v = visitorById.get(userId);
        const latestAt = userThreads.reduce(
          (max, t) => (t.latestAt > max ? t.latestAt : max),
          userThreads[0]?.latestAt ?? new Date(0).toISOString(),
        );
        return {
          id: userId,
          label: visitorLabel(v?.displayName),
          email: null,
          threadCount: userThreads.length,
          escalatedCount: userThreads.filter((t) => t.status === "escalated")
            .length,
          latestAt,
        };
      })
      .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));

    return { users, threads };
  } catch (error) {
    console.error("[loadConversationsInbox]", error);
    return { users: [], threads: [] };
  }
}

export async function loadConversationMessages(
  organizationId: string,
  threadId: string,
): Promise<InboxThread["messages"] | null> {
  const [state] = await db
    .select({
      organizationId: conversationStates.organization_id,
    })
    .from(conversationStates)
    .where(eq(conversationStates.thread_id, threadId))
    .limit(1);

  if (!state || state.organizationId !== organizationId) {
    return null;
  }

  const msgs = await db
    .select({
      id: schema.threadMessages.id,
      role: schema.threadMessages.role,
      content: schema.threadMessages.content,
      agent_id: schema.threadMessages.agent_id,
      metadata: schema.threadMessages.metadata,
      created_at: schema.threadMessages.created_at,
    })
    .from(schema.threadMessages)
    .where(eq(schema.threadMessages.thread_id, threadId))
    .orderBy(asc(schema.threadMessages.created_at))
    .limit(500);

  return msgs.map((m) => {
    const meta = (m.metadata ?? {}) as {
      source?: string;
      agent_id?: string;
      agent_name?: string;
      provenance?: {
        sources?: InboxThread["messages"][number]["sources"];
      };
    };
    const fromHuman =
      m.role === "human" ||
      meta.source === "human_agent" ||
      meta.source === "human";
    const sources = meta.provenance?.sources;
    const role: InboxThread["messages"][number]["role"] =
      m.role === "assistant" || m.role === "system" || m.role === "human"
        ? m.role
        : "user";
    const agentId = m.agent_id ?? meta.agent_id ?? null;
    const agentName =
      (typeof meta.agent_name === "string" && meta.agent_name.trim()) ||
      (agentId ? agentDisplayName(agentId) : null);
    return {
      id: m.id,
      role: fromHuman && role === "assistant" ? "human" : role,
      content: m.content,
      created_at: (m.created_at ?? new Date()).toISOString(),
      ...(fromHuman ? { fromHuman: true } : {}),
      ...(agentId ? { agentId, agentName } : {}),
      ...(sources && sources.length > 0 ? { sources } : {}),
    };
  });
}
