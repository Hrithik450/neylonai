/**
 * Agent dashboard performance — from live org conversations.
 */

import { desc, eq } from "drizzle-orm";
import { db, threads } from "@neylonai/database";

export type AgentActivityItem = {
  id: string;
  kind: string;
  label: string;
  conversationId: string | null;
  ticketId: string | null;
  created_at: string;
};

export type AgentPerformanceSnapshot = {
  outcomeCount: number;
  outcomeLabel: string;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  conversations: number;
  resolutions: number;
  escalations: number;
  /** Secondary outcome bucket (e.g. escalations for Main Agent). */
  actions: number;
  activity: AgentActivityItem[];
};

function emptySnapshot(outcomeLabel: string): AgentPerformanceSnapshot {
  return {
    outcomeCount: 0,
    outcomeLabel,
    lastActivityAt: null,
    lastActivityLabel: null,
    conversations: 0,
    resolutions: 0,
    escalations: 0,
    actions: 0,
    activity: [],
  };
}

export async function getAgentPerformance(
  organizationId: string,
  agentKey: string,
  outcomeLabel = "Outcomes",
): Promise<AgentPerformanceSnapshot> {
  const { MAIN_AGENT_KEY } = await import("../agents/org-agents.types");
  if (agentKey === MAIN_AGENT_KEY) {
    return getMainAgentPerformance(organizationId, outcomeLabel);
  }
  // Blueprints and non-runtime agents have no live metrics yet.
  return emptySnapshot(outcomeLabel);
}

async function getMainAgentPerformance(
  organizationId: string,
  outcomeLabel: string,
): Promise<AgentPerformanceSnapshot> {
  const rows = await db
    .select({
      id: threads.id,
      escalated: threads.escalated,
      createdAt: threads.created_at,
    })
    .from(threads)
    .where(eq(threads.organization_id, organizationId))
    .orderBy(desc(threads.created_at))
    .limit(200);

  const conversations = rows.length;
  const escalations = rows.filter((r) => r.escalated).length;

  const activity: AgentActivityItem[] = rows.slice(0, 40).map((r) => {
    const kind = r.escalated ? "escalated_conversation" : "answered_customer";
    const label = r.escalated ? "Needs follow-up" : "Answered customer";
    return {
      id: `conv:${r.id}`,
      kind,
      label,
      conversationId: r.id,
      ticketId: null,
      created_at: (r.createdAt ?? new Date()).toISOString(),
    };
  });

  const latest = activity[0] ?? null;

  return {
    outcomeCount: conversations,
    outcomeLabel,
    lastActivityAt: latest?.created_at ?? null,
    lastActivityLabel: latest?.label ?? null,
    conversations,
    resolutions: 0,
    escalations,
    actions: escalations,
    activity,
  };
}

export async function getAgentOutcomeCounts(
  organizationId: string,
  agentIds: string[],
): Promise<
  Map<
    string,
    {
      outcomeCount: number;
      lastActivityAt: string | null;
      lastActivityLabel: string | null;
    }
  >
> {
  const out = new Map<
    string,
    {
      outcomeCount: number;
      lastActivityAt: string | null;
      lastActivityLabel: string | null;
    }
  >();

  await Promise.all(
    agentIds.map(async (id) => {
      const snap = await getAgentPerformance(organizationId, id);
      out.set(id, {
        outcomeCount: snap.outcomeCount,
        lastActivityAt: snap.lastActivityAt,
        lastActivityLabel: snap.lastActivityLabel,
      });
    }),
  );

  return out;
}
