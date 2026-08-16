"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

type AgentDetail = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  capabilities?: string[];
  activityKinds?: string[];
  integrationIds?: string[];
  requiredIntegrationIds?: string[];
  performance?: {
    conversations: number;
    resolutions: number;
    escalations: number;
    actions: number;
    outcomeLabel: string;
  };
};

type ActivityRow = {
  id: string;
  label: string;
  conversationId: string | null;
  created_at: string;
};

type IntegrationRow = {
  id: string;
  name: string;
  enabled: boolean;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function capabilityLabels(agent: AgentDetail): string[] {
  if (agent.capabilities?.length) return agent.capabilities;

  const labels: Record<string, string> = {
    answered_customer: "Answer customers",
    escalated_conversation: "Human escalation",
    shared_meeting_link: "Meeting links",
  };
  return (agent.activityKinds ?? []).map(
    (kind) => labels[kind] ?? kind.replace(/_/g, " "),
  );
}

/**
 * Single-agent dashboard. Main Agent is the only runtime agent and is always on;
 * knowledge, meetings, search, databases, and escalation are tools it can use.
 */
export function AgentsMasterDetail() {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [agentResponse, integrationsResponse] = await Promise.all([
          fetch("/api/v1/agents?agentId=main-agent"),
          fetch("/api/v1/integrations"),
        ]);
        const agentJson = (await agentResponse.json()) as {
          success: boolean;
          data?: { agent: AgentDetail; activity: ActivityRow[] };
          error?: string;
        };
        const integrationsJson = (await integrationsResponse.json()) as {
          success: boolean;
          data?: { integrations: IntegrationRow[] };
        };

        if (!agentJson.success || !agentJson.data) {
          throw new Error(agentJson.error ?? "Failed to load Main Agent");
        }
        if (cancelled) return;

        const nextAgent = agentJson.data.agent;
        const allowed = new Set([
          ...(nextAgent.integrationIds ?? []),
          ...(nextAgent.requiredIntegrationIds ?? []),
        ]);

        setAgent(nextAgent);
        setActivity(agentJson.data.activity ?? []);
        setIntegrations(
          (integrationsJson.data?.integrations ?? []).filter(
            (integration) =>
              allowed.size === 0 || allowed.has(integration.id),
          ),
        );
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load Main Agent",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const capabilities = useMemo(
    () => (agent ? capabilityLabels(agent) : []),
    [agent],
  );

  if (loading) {
    return <p className="caption text-sm">Loading Main Agent…</p>;
  }

  if (error || !agent) {
    return (
      <p className="caption text-sm text-[var(--red)]">
        {error ?? "Main Agent not found."}
      </p>
    );
  }

  const performance = agent.performance ?? {
    conversations: 0,
    resolutions: 0,
    escalations: 0,
    actions: 0,
    outcomeLabel: "actions",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <p className="text-[0.65rem] tracking-[0.16em] uppercase opacity-60">
            AI runtime
          </p>
          <h1 className="text-3xl sm:text-4xl">{agent.name}</h1>
          <p className="caption text-sm max-w-2xl">{agent.description}</p>
        </div>
        <span
          className="sticker sticker-lowercase text-xs"
          style={{ background: "var(--green)", color: "#fff" }}
        >
          always on
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <section className="ink-card p-5 sm:p-6 space-y-5">
          <div className="space-y-3">
            <SectionLabel>Overview</SectionLabel>
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <div>
                <dd className="text-3xl font-medium tabular-nums">
                  {performance.conversations}
                </dd>
                <dt className="caption text-xs">conversations</dt>
              </div>
              <div>
                <dd className="text-3xl font-medium tabular-nums">
                  {performance.resolutions}
                </dd>
                <dt className="caption text-xs">resolutions</dt>
              </div>
              <div>
                <dd className="text-3xl font-medium tabular-nums">
                  {performance.escalations}
                </dd>
                <dt className="caption text-xs">escalations</dt>
              </div>
              <div>
                <dd className="text-3xl font-medium tabular-nums">
                  {performance.actions}
                </dd>
                <dt className="caption text-xs lowercase">
                  {performance.outcomeLabel}
                </dt>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            <SectionLabel>Tools and capabilities</SectionLabel>
            <ul className="flex flex-wrap gap-2">
              {capabilities.map((capability) => (
                <li
                  key={capability}
                  className="caption text-xs rounded-sm border border-[var(--ink)]/15 bg-[var(--cream)] px-2.5 py-1"
                >
                  {capability}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Connected tools</SectionLabel>
              <Link
                href="/dashboard/integrations"
                className="caption text-xs underline underline-offset-4"
              >
                Manage integrations
              </Link>
            </div>
            {integrations.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {integrations.map((integration) => (
                  <li
                    key={integration.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-[var(--ink)]/10 px-3 py-2 text-sm"
                  >
                    <span>{integration.name}</span>
                    <span className="caption text-xs">
                      {integration.enabled ? "enabled" : "off"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption text-sm">No integrations configured yet.</p>
            )}
          </div>
        </section>

        <aside className="ink-card p-5 sm:p-6 space-y-3 h-fit">
          <SectionLabel>Recent activity</SectionLabel>
          {activity.length ? (
            <ul className="scrollbar-hide divide-y divide-[var(--ink)]/10 h-[28rem] overflow-y-auto pr-1">
              {activity.slice(0, 12).map((item) => (
                <li
                  key={item.id}
                  className="py-3 flex flex-wrap items-baseline justify-between gap-2 text-sm"
                >
                  <div>
                    <p>{item.label}</p>
                    {item.conversationId ? (
                      <Link
                        href={`/dashboard/conversations?thread=${item.conversationId}`}
                        className="caption text-xs underline underline-offset-4"
                      >
                        View conversation
                      </Link>
                    ) : null}
                  </div>
                  <span className="caption text-xs whitespace-nowrap">
                    {formatWhen(item.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="caption text-sm">No activity yet.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
