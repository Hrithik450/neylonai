/**
 * Agent dashboard performance — from live org conversations and leads.
 */

import { and, desc, eq, or, isNull } from "drizzle-orm";
import {
  db,
  conversationStates,
  leads,
} from "@neylonai/database";

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
  leadsOrActions: number;
  activity: AgentActivityItem[];
};

function isSupportAgent(agentId: string): boolean {
  return agentId === "neylonai-chatbot";
}

function emptySnapshot(outcomeLabel: string): AgentPerformanceSnapshot {
  return {
    outcomeCount: 0,
    outcomeLabel,
    lastActivityAt: null,
    lastActivityLabel: null,
    conversations: 0,
    resolutions: 0,
    escalations: 0,
    leadsOrActions: 0,
    activity: [],
  };
}

export async function getAgentPerformance(
  organizationId: string,
  agentId: string,
  outcomeLabel = "Outcomes",
): Promise<AgentPerformanceSnapshot> {
  if (agentId === "lead") {
    return getLeadPerformance(organizationId, outcomeLabel);
  }
  if (agentId === "sales" || agentId === "booking") {
    return emptySnapshot(outcomeLabel);
  }
  return getSupportLikePerformance(organizationId, agentId, outcomeLabel);
}

async function getSupportLikePerformance(
  organizationId: string,
  agentId: string,
  outcomeLabel: string,
): Promise<AgentPerformanceSnapshot> {
  const agentFilter = isSupportAgent(agentId)
    ? or(
        eq(conversationStates.assigned_agent_id, agentId),
        isNull(conversationStates.assigned_agent_id),
      )
    : eq(conversationStates.assigned_agent_id, agentId);

  const states = await db
    .select({
      id: conversationStates.id,
      threadId: conversationStates.thread_id,
      status: conversationStates.status,
      updatedAt: conversationStates.updated_at,
      createdAt: conversationStates.created_at,
      reason: conversationStates.escalation_reason,
    })
    .from(conversationStates)
    .where(
      and(
        eq(conversationStates.organization_id, organizationId),
        agentFilter,
      ),
    )
    .orderBy(desc(conversationStates.updated_at))
    .limit(200);

  const conversations = states.length;
  const escalations = states.filter((s) => s.status === "escalated").length;
  const resolutions = states.filter((s) => s.status === "resolved").length;

  const activity: AgentActivityItem[] = [];

  for (const s of states.slice(0, 40)) {
    let kind = "answered_customer";
    let label = "Answered customer";
    if (s.status === "escalated") {
      kind = "escalated_conversation";
      label = s.reason?.trim()
        ? `Needs follow-up — ${s.reason.trim().slice(0, 80)}`
        : "Needs follow-up";
    } else if (s.status === "resolved") {
      label = "Resolved conversation";
    }
    activity.push({
      id: `conv:${s.id}`,
      kind,
      label,
      conversationId: s.threadId,
      ticketId: null,
      created_at: (s.updatedAt ?? s.createdAt ?? new Date()).toISOString(),
    });
  }

  const latest = activity[0] ?? null;

  return {
    outcomeCount: conversations,
    outcomeLabel,
    lastActivityAt: latest?.created_at ?? null,
    lastActivityLabel: latest?.label ?? null,
    conversations,
    resolutions,
    escalations,
    leadsOrActions: escalations,
    activity,
  };
}

async function getLeadPerformance(
  organizationId: string,
  outcomeLabel: string,
): Promise<AgentPerformanceSnapshot> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      threadId: leads.thread_id,
      status: leads.status,
      createdAt: leads.created_at,
    })
    .from(leads)
    .where(
      and(
        eq(leads.organization_id, organizationId),
        or(eq(leads.source_agent_id, "lead"), isNull(leads.source_agent_id)),
      ),
    )
    .orderBy(desc(leads.created_at))
    .limit(100);

  const activity: AgentActivityItem[] = rows.map((r) => ({
    id: `lead:${r.id}`,
    kind: "captured_lead",
    label: r.name?.trim()
      ? `Captured lead — ${r.name.trim()}`
      : r.email?.trim()
        ? `Captured lead — ${r.email.trim()}`
        : "Captured lead",
    conversationId: r.threadId,
    ticketId: null,
    created_at: (r.createdAt ?? new Date()).toISOString(),
  }));

  const latest = activity[0] ?? null;
  return {
    outcomeCount: rows.length,
    outcomeLabel,
    lastActivityAt: latest?.created_at ?? null,
    lastActivityLabel: latest?.label ?? null,
    conversations: rows.length,
    resolutions: rows.filter((r) => r.status === "qualified").length,
    escalations: 0,
    leadsOrActions: rows.length,
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
