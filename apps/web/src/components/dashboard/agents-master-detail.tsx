"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AgentConfigField } from "@neylonai/agent";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";

type AgentRow = {
  id: string;
  name: string;
  purpose: string;
  description: string;
  active: boolean;
  outcomeCount: number;
  outcomeLabel: string;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  tier: "basic" | "advanced";
  available: boolean;
  isDefault?: boolean;
};

type AgentDetail = AgentRow & {
  config: Record<string, unknown>;
  integrationIds: string[];
  requiredIntegrationIds?: string[];
  missingRequiredIntegrations?: string[];
  configSchema: AgentConfigField[];
  activityKinds?: string[];
  builtIn?: boolean;
  runnable?: boolean;
  performance?: {
    conversations: number;
    resolutions: number;
    escalations: number;
    leadsOrActions: number;
    outcomeLabel: string;
  };
};

type ActivityRow = {
  id: string;
  kind: string;
  label: string;
  conversationId: string | null;
  ticketId: string | null;
  created_at: string;
};

type IntegrationRow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

type UpgradePromptData = {
  title: string;
  detail: string;
  ctaLabel: string;
  href: string;
};

const SEARCH_THRESHOLD = 6;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mono block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function AgentGlyph({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8 text-[0.65rem]" : "h-11 w-11 text-sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm border border-[var(--ink)] bg-[var(--cream)] font-semibold",
        dim,
      )}
      aria-hidden
    >
      {agentInitials(name)}
    </span>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "No recent activity";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFullWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function whenItRuns(agent: AgentDetail): string {
  if (!agent.active) {
    return "Not running — turn it on when you’re ready.";
  }
  if (agent.runnable === false) {
    return "Installed but not yet handling live chats.";
  }
  if (agent.id === "lead") {
    return "Runs alongside conversations to capture and qualify leads.";
  }
  return "Handles customer messages on your website widget.";
}

function capabilityLabels(kinds: string[] | undefined): string[] {
  const map: Record<string, string> = {
    answered_customer: "answer customers",
    captured_lead: "capture leads",
    qualified_lead: "qualify leads",
    used_crm: "send to CRM",
    escalated_conversation: "escalate for follow-up",
    created_ticket: "escalate for follow-up",
    booked_meeting: "book meetings",
    qualified_prospect: "qualify prospects",
  };
  return (kinds ?? []).map((k) => map[k] ?? k.replace(/_/g, " ").toLowerCase());
}

/**
 * Master-detail Agents UI — list + details on one page, no per-agent routes.
 */
export function AgentsMasterDetail() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("agent"),
  );
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptData | null>(
    null,
  );
  const [plan, setPlan] = useState("free");
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [query, setQuery] = useState("");
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/v1/agents");
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        plan: string;
        agents: AgentRow[];
        upgradePrompt: UpgradePromptData | null;
      };
      error?: string;
    };
    if (json.success && json.data) {
      setAgents(json.data.agents);
      setPlan(json.data.plan);
      setUpgradePrompt(json.data.upgradePrompt);
      setListMessage(null);
    } else {
      setListMessage(json.error ?? "Failed to load agents");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Resolve selection from URL or default to first agent.
  useEffect(() => {
    if (agents.length === 0) return;
    const fromUrl = searchParams.get("agent");
    const next =
      fromUrl && agents.some((a) => a.id === fromUrl)
        ? fromUrl
        : selectedId && agents.some((a) => a.id === selectedId)
          ? selectedId
          : agents[0]!.id;

    if (next !== selectedId) {
      setSelectedId(next);
    }

    if (fromUrl !== next) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("agent", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }

    if (fromUrl && fromUrl === next) setMobilePane("detail");
    // Intentionally omit selectedId to avoid replace loops; URL is source of truth after first sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from agents/URL only
  }, [agents, searchParams, pathname, router]);

  const selectAgent = useCallback(
    (id: string) => {
      setSelectedId(id);
      setMobilePane("detail");
      setShowAdvancedConfig(false);
      setDetailMessage(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("agent", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadDetail = useCallback(async (agentId: string) => {
    setLoadingDetail(true);
    setDetailMessage(null);
    try {
      const [agentRes, intRes] = await Promise.all([
        fetch(`/api/v1/agents?agentId=${encodeURIComponent(agentId)}`),
        fetch("/api/v1/integrations"),
      ]);
      const agentJson = (await agentRes.json()) as {
        success: boolean;
        data?: {
          agent: AgentDetail;
          activity: ActivityRow[];
        };
        error?: string;
      };
      const intJson = (await intRes.json()) as {
        success: boolean;
        data?: { integrations: IntegrationRow[] };
      };

      if (!agentJson.success || !agentJson.data) {
        setDetail(null);
        setDetailMessage(agentJson.error ?? "Agent not found");
        return;
      }

      const agent = agentJson.data.agent;
      setDetail(agent);
      setConfig(agent.config ?? {});
      setActivity(agentJson.data.activity ?? []);

      const allowed = new Set([
        ...(agent.integrationIds ?? []),
        ...(agent.requiredIntegrationIds ?? []),
      ]);
      const all = intJson.data?.integrations ?? [];
      setIntegrations(
        all
          .filter((i) => allowed.size === 0 || allowed.has(i.id))
          .map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            enabled: i.enabled,
          })),
      );

      // Keep list row status in sync.
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? {
                ...a,
                active: agent.active,
                outcomeCount: agent.outcomeCount,
                lastActivityAt: agent.lastActivityAt,
                lastActivityLabel: agent.lastActivityLabel,
              }
            : a,
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      [a.name, a.purpose, a.description].join(" ").toLowerCase().includes(q),
    );
  }, [agents, query]);

  const showSearch = agents.length >= SEARCH_THRESHOLD;

  const primaryConfig = useMemo(() => {
    const schema = detail?.configSchema ?? [];
    if (schema.length <= 4)
      return { primary: schema, advanced: [] as AgentConfigField[] };
    return {
      primary: schema.slice(0, 3),
      advanced: schema.slice(3),
    };
  }, [detail?.configSchema]);

  const performance = useMemo(() => {
    if (!detail) return null;
    if (detail.performance) {
      return {
        conversations: detail.performance.conversations,
        resolutions: detail.performance.resolutions,
        escalations: detail.performance.escalations,
        leadsOrActions: detail.performance.leadsOrActions,
        outcomeLabel: detail.performance.outcomeLabel,
      };
    }
    const escalations = activity.filter(
      (a) =>
        a.kind.includes("escalat") ||
        a.label.toLowerCase().includes("escalat") ||
        a.label.toLowerCase().includes("follow-up"),
    ).length;
    const leads = activity.filter(
      (a) => a.kind.includes("lead") || a.label.toLowerCase().includes("lead"),
    ).length;
    const answered = activity.filter(
      (a) =>
        a.kind.includes("answered") ||
        a.label.toLowerCase().includes("answered"),
    ).length;
    return {
      conversations: Math.max(detail.outcomeCount, answered || activity.length),
      resolutions: Math.max(0, answered || detail.outcomeCount - escalations),
      escalations,
      leadsOrActions: leads || escalations || detail.outcomeCount,
      outcomeLabel: detail.outcomeLabel,
    };
  }, [activity, detail]);

  const toggleActive = async () => {
    if (!detail) return;
    if (detail.isDefault) {
      setDetailMessage("Support Agent is the default agent and stays enabled.");
      return;
    }
    const next = !detail.active;
    if (next && (detail.missingRequiredIntegrations?.length ?? 0) > 0) {
      setDetailMessage(
        `Enable required integrations first: ${detail.missingRequiredIntegrations!.join(", ")}.`,
      );
      return;
    }
    setBusy(true);
    setDetailMessage(null);
    try {
      const nextConfig =
        detail.id === "lead" ? { ...config, leadAgentEnabled: next } : config;
      const res = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: detail.id,
          enabled: next,
          config: nextConfig,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        missingRequiredIntegrations?: string[];
      };
      if (!json.success) {
        if (json.missingRequiredIntegrations?.length) {
          setDetail({
            ...detail,
            missingRequiredIntegrations: json.missingRequiredIntegrations,
          });
        }
        throw new Error(json.error ?? "Update failed");
      }
      setConfig(nextConfig);
      setDetail({
        ...detail,
        active: next,
        config: nextConfig,
        missingRequiredIntegrations: next
          ? []
          : detail.missingRequiredIntegrations,
      });
      setAgents((prev) =>
        prev.map((a) => (a.id === detail.id ? { ...a, active: next } : a)),
      );
      setDetailMessage(next ? "Enabled." : "Disabled.");
    } catch (e) {
      setDetailMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    if (!detail) return;
    setBusy(true);
    setDetailMessage(null);
    try {
      const res = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: detail.id,
          enabled: detail.active,
          config,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Save failed");

      // Support Agent handoff toggles still live in engagement settings.
      // Lead Agent fields are stored only on organization_agents via the POST above.
      if (detail.id !== "lead") {
        const patch: Record<string, unknown> = {};
        if (typeof config.humanHandoffEnabled === "boolean") {
          patch.humanHandoffEnabled = config.humanHandoffEnabled;
        }
        if (typeof config.availabilityMode === "string") {
          patch.availabilityMode = config.availabilityMode;
        }
        if (typeof config.defaultTeam === "string") {
          patch.defaultTeam = config.defaultTeam;
        }
        if (typeof config.customerHandoffMessage === "string") {
          patch.customerHandoffMessage = config.customerHandoffMessage;
        }
        if (typeof config.unavailableMessage === "string") {
          patch.unavailableMessage = config.unavailableMessage;
        }
        if (
          typeof config.escalationExplicitRequest === "boolean" ||
          typeof config.escalationFrustration === "boolean" ||
          typeof config.escalationUnhelpful === "boolean"
        ) {
          patch.escalationConditions = {
            explicitHumanRequest: Boolean(config.escalationExplicitRequest),
            frustration: Boolean(config.escalationFrustration),
            repeatedUnhelpful: Boolean(config.escalationUnhelpful),
            lowConfidence: true,
            businessRules: true,
          };
        }
        if (Object.keys(patch).length > 0) {
          await fetch("/api/v1/engagement-settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
        }
      }

      setDetailMessage("Configuration saved.");
    } catch (e) {
      setDetailMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1 min-w-0">
        <h1 className="text-3xl sm:text-4xl">Agents</h1>
        <p className="caption text-sm max-w-2xl">
          Your AI workforce. Select an agent to see what it does, how it
          performs, and how to configure it.
        </p>
      </header>

      {upgradePrompt ? <UpgradePrompt {...upgradePrompt} /> : null}
      {listMessage ? (
        <p className="caption text-sm text-[var(--red)]">{listMessage}</p>
      ) : null}

      <div className="ink-card overflow-hidden min-h-[70vh] lg:min-h-[calc(100vh-16rem)] grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* Left: agent list */}
        <aside
          className={cn(
            "border-b lg:border-b-0 lg:border-r border-[var(--ink)]/15 bg-[var(--cream)]/35 flex flex-col min-h-0",
            mobilePane === "detail" ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="px-3 py-3 border-b border-[var(--ink)]/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Agents</SectionLabel>
              <span className="caption text-[0.65rem]">{agents.length}</span>
            </div>
            {showSearch ? (
              <input
                className="ink-input py-2 text-sm"
                placeholder="Filter agents…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            ) : null}
          </div>

          <ul className="flex-1 overflow-y-auto divide-y divide-[var(--ink)]/10 max-h-[40vh] lg:max-h-none">
            {filtered.length === 0 ? (
              <li className="p-4 caption text-sm">No agents match.</li>
            ) : (
              filtered.map((agent) => {
                const active = agent.id === selectedId;
                return (
                  <li key={agent.id}>
                    <button
                      type="button"
                      onClick={() => selectAgent(agent.id)}
                      className={cn(
                        "w-full text-left px-3 py-3 flex gap-3 transition-colors border-l-4",
                        active
                          ? "bg-white border-l-[var(--ink)]"
                          : "border-l-transparent hover:bg-white/70",
                      )}
                    >
                      <AgentGlyph name={agent.name} size="sm" />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium line-clamp-1">
                            {agent.name}
                          </span>
                          <span
                            className="sticker sticker-lowercase shrink-0 text-[0.55rem]"
                            style={{
                              background: agent.active
                                ? "var(--green)"
                                : "var(--cream)",
                              color: agent.active ? "#fff" : "var(--ink)",
                            }}
                          >
                            {agent.isDefault
                              ? "default"
                              : agent.active
                                ? "active"
                                : "off"}
                          </span>
                        </span>
                        <span className="caption text-xs line-clamp-1 block">
                          {agent.purpose}
                        </span>
                        {agent.lastActivityAt ? (
                          <span className="caption text-[0.6rem] block opacity-70">
                            {agent.lastActivityLabel
                              ? `${agent.lastActivityLabel} · `
                              : ""}
                            {formatWhen(agent.lastActivityAt)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Right: details */}
        <div
          className={cn(
            "flex flex-col min-h-0 min-w-0",
            mobilePane === "list" ? "hidden lg:flex" : "flex",
          )}
        >
          {loadingDetail && !detail ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="caption text-sm">Loading agent…</p>
            </div>
          ) : detail ? (
            <>
              <div className="px-4 sm:px-6 py-4 border-b border-[var(--ink)]/10 space-y-3 shrink-0">
                <button
                  type="button"
                  className="lg:hidden caption text-xs underline underline-offset-4"
                  onClick={() => setMobilePane("list")}
                >
                  ← All agents
                </button>

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <AgentGlyph name={detail.name} />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-medium">{detail.name}</h2>
                        <span
                          className="sticker sticker-lowercase text-[0.65rem]"
                          style={{
                            background: detail.active
                              ? "var(--green)"
                              : "var(--cream)",
                            color: detail.active ? "#fff" : "var(--ink)",
                          }}
                        >
                          {detail.active ? "active" : "inactive"}
                        </span>
                      </div>
                      <p className="text-sm">{detail.purpose}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.isDefault ? (
                      <span className="sticker sticker-lowercase text-[0.55rem] self-center">
                        default
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-ink text-xs px-3 py-1.5"
                        disabled={
                          busy ||
                          (!detail.active &&
                            (!detail.available ||
                              (detail.missingRequiredIntegrations?.length ??
                                0) > 0))
                        }
                        onClick={() => void toggleActive()}
                      >
                        {detail.active ? "disable" : "enable"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ink bg-white text-xs px-3 py-1.5"
                      onClick={() => {
                        setShowAdvancedConfig(true);
                        document
                          .getElementById("agent-configuration")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </div>
                {detailMessage ? (
                  <p className="caption text-xs">{detailMessage}</p>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto max-h-[55vh] lg:max-h-none">
                <div className="grid lg:grid-cols-2 min-h-0">
                  {/* Overview */}
                  <section className="p-4 sm:p-6 space-y-6 lg:border-r border-[var(--ink)]/10">
                    <div className="space-y-3">
                      <SectionLabel>Overview</SectionLabel>
                      <p className="text-sm leading-relaxed">
                        {detail.description}
                      </p>
                      <dl className="grid gap-4 text-sm pt-1">
                        <div>
                          <SectionLabel>When it runs</SectionLabel>
                          <p className="mt-1">{whenItRuns(detail)}</p>
                        </div>
                        <div>
                          <SectionLabel>Channels</SectionLabel>
                          <p className="mt-1">
                            {detail.runnable === false
                              ? "Not connected to live channels yet"
                              : "Website widget"}
                          </p>
                        </div>
                      </dl>
                    </div>

                    <div className="space-y-3">
                      <SectionLabel>Capabilities</SectionLabel>
                      <ul className="flex flex-wrap gap-2">
                        {capabilityLabels(detail.activityKinds).map((label) => (
                          <li
                            key={label}
                            className="caption text-xs rounded-sm border border-[var(--ink)]/15 bg-[var(--cream)] px-2.5 py-1"
                          >
                            {label}
                          </li>
                        ))}
                        {capabilityLabels(detail.activityKinds).length === 0 ? (
                          <li className="caption text-sm">
                            No capabilities listed.
                          </li>
                        ) : null}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <SectionLabel>Integrations</SectionLabel>
                        <Link
                          href="/dashboard/integrations"
                          className="caption text-xs underline underline-offset-4 shrink-0"
                        >
                          Manage integrations
                        </Link>
                      </div>
                      {(detail.requiredIntegrationIds?.length ?? 0) > 0 ? (
                        <p className="caption text-sm">
                          Integrations required before enabling:{" "}
                          {(detail.requiredIntegrationIds ?? []).join(", ")}.
                          {(detail.missingRequiredIntegrations?.length ?? 0) >
                          0 ? (
                            <>
                              {" "}
                              Missing:{" "}
                              {detail.missingRequiredIntegrations!.join(
                                ", ",
                              )}.{" "}
                              <Link
                                href="/dashboard/integrations"
                                className="underline"
                              >
                                Enable them
                              </Link>
                              .
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p className="caption text-sm">
                          Integrations recommended for better use
                          {(detail.integrationIds ?? []).length > 0
                            ? `: ${(detail.integrationIds ?? []).join(", ").replace(/, ([^,]*)$/, " & $1")}.`
                            : "."}
                        </p>
                      )}
                      {integrations.length === 0 ? (
                        <p className="caption text-xs">
                          None listed for this agent.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {integrations.map((i) => {
                            const required = (
                              detail.requiredIntegrationIds ?? []
                            ).includes(i.id);
                            return (
                              <li
                                key={i.id}
                                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                              >
                                <span className="caption text-sm lowercase">
                                  {i.id}
                                  {required ? (
                                    <span className="opacity-60">
                                      {" "}
                                      · required
                                    </span>
                                  ) : null}
                                </span>
                                <span
                                  className="sticker sticker-lowercase text-[0.55rem]"
                                  style={{
                                    background: i.enabled
                                      ? "var(--green)"
                                      : "var(--cream)",
                                    color: i.enabled ? "#fff" : "var(--ink)",
                                  }}
                                >
                                  {i.enabled ? "enabled" : "off"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div
                      id="agent-configuration"
                      className="space-y-4 scroll-mt-4 border-t border-[var(--ink)]/10 pt-6"
                    >
                      <SectionLabel>Configuration</SectionLabel>
                      {primaryConfig.primary.length === 0 ? (
                        <p className="caption text-sm">
                          No configuration for this agent yet.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {primaryConfig.primary.map((field) => (
                            <ConfigFieldControl
                              key={field.key}
                              field={field}
                              value={config[field.key]}
                              onChange={(next) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  [field.key]: next,
                                }))
                              }
                            />
                          ))}
                        </div>
                      )}

                      {primaryConfig.advanced.length > 0 ? (
                        <div className="pt-2">
                          <button
                            type="button"
                            className="caption text-sm underline underline-offset-4"
                            onClick={() => setShowAdvancedConfig((v) => !v)}
                          >
                            {showAdvancedConfig
                              ? "Hide advanced settings"
                              : "Show advanced settings"}
                          </button>
                          {showAdvancedConfig ? (
                            <div className="mt-4 space-y-4 border-t border-[var(--ink)]/10 pt-4">
                              {primaryConfig.advanced.map((field) => (
                                <ConfigFieldControl
                                  key={field.key}
                                  field={field}
                                  value={config[field.key]}
                                  onChange={(next) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      [field.key]: next,
                                    }))
                                  }
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          className="btn-ink px-5 py-2.5 text-sm"
                          disabled={
                            busy || (detail.configSchema?.length ?? 0) === 0
                          }
                          onClick={() => void saveConfig()}
                        >
                          {busy ? "Saving…" : "Save configuration"}
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Performance */}
                  <section className="p-4 sm:p-6 space-y-6 bg-[var(--cream)]/25">
                    <div className="space-y-3">
                      <SectionLabel>Performance</SectionLabel>
                      {performance ? (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-2xl font-medium tabular-nums">
                              {performance.conversations}
                            </p>
                            <p className="caption text-xs">conversations</p>
                          </div>
                          <div>
                            <p className="text-2xl font-medium tabular-nums">
                              {performance.resolutions}
                            </p>
                            <p className="caption text-xs">resolutions</p>
                          </div>
                          <div>
                            <p className="text-2xl font-medium tabular-nums">
                              {performance.escalations}
                            </p>
                            <p className="caption text-xs">escalations</p>
                          </div>
                          <div>
                            <p className="text-2xl font-medium tabular-nums">
                              {performance.leadsOrActions}
                            </p>
                            <p className="caption text-xs lowercase">
                              {performance.outcomeLabel}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="caption text-sm">No performance yet.</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <SectionLabel>Recent activity</SectionLabel>
                      <ul className="divide-y divide-[var(--ink)]/10">
                        {activity.slice(0, 12).map((a) => (
                          <li
                            key={a.id}
                            className="py-2.5 flex flex-wrap items-baseline justify-between gap-2 text-sm"
                          >
                            <div>
                              <p>{a.label}</p>
                              {a.conversationId ? (
                                <Link
                                  href={`/dashboard/conversations?thread=${a.conversationId}`}
                                  className="caption text-xs underline"
                                >
                                  View conversation
                                </Link>
                              ) : null}
                            </div>
                            <span className="caption text-xs whitespace-nowrap">
                              {formatFullWhen(a.created_at)}
                            </span>
                          </li>
                        ))}
                        {activity.length === 0 ? (
                          <li className="py-2 caption text-sm">
                            No activity yet.
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="caption text-sm text-center max-w-xs">
                {detailMessage ?? "Select an agent to view details."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigFieldControl({
  field,
  value,
  onChange,
}: {
  field: AgentConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "boolean") {
    const checked =
      typeof value === "boolean" ? value : Boolean(field.defaultValue);
    return (
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="text-sm font-medium block">{field.label}</span>
          {field.description ? (
            <span className="caption text-xs">{field.description}</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (field.type === "string_list") {
    const selected = Array.isArray(value)
      ? (value as string[])
      : (field.defaultValue ?? []);
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{field.label}</legend>
        {field.description ? (
          <p className="caption text-xs">{field.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {field.options.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    onChange(
                      on
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value],
                    );
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (field.type === "select") {
    const current =
      typeof value === "string" ? value : (field.defaultValue ?? "");
    return (
      <label className="block space-y-1">
        <span className="text-sm font-medium">{field.label}</span>
        {field.description ? (
          <span className="caption text-xs block">{field.description}</span>
        ) : null}
        <select
          className="ink-input"
          value={current}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const text =
    typeof value === "string" ? value : String(field.defaultValue ?? "");
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{field.label}</span>
      {field.description ? (
        <span className="caption text-xs block">{field.description}</span>
      ) : null}
      {field.multiline ? (
        <textarea
          className="ink-input min-h-[5rem]"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="ink-input"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
