import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardOverviewData } from "@/server/dashboard-overview";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  const bg =
    tone === "ok"
      ? "var(--green)"
      : tone === "warn"
        ? "var(--yellow)"
        : "var(--red)";
  const color = tone === "warn" ? "var(--ink)" : "#fff";
  return (
    <span
      className="sticker inline-block text-[0.65rem]"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

export function DashboardOverview({ data }: { data: DashboardOverviewData }) {
  const statusTone =
    data.chatbotStatus.label === "Active"
      ? "ok"
      : data.chatbotStatus.label === "Needs attention"
        ? "warn"
        : "bad";

  const usagePct =
    data.metrics.aiCreditsLimit > 0
      ? Math.min(
          100,
          Math.round(
            (data.metrics.aiCreditsUsed / data.metrics.aiCreditsLimit) * 100,
          ),
        )
      : 0;

  return (
    <div className="space-y-10">
      {/* 1. Welcome / status */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          <h1 id="overview-heading" className="text-3xl sm:text-4xl">
            Welcome back, {data.member.firstName}
          </h1>
          <p className="caption text-sm">
            {data.member.organizationName}
            <span className="mx-2 opacity-40">·</span>
            <span className="mono text-[0.7rem]">
              {data.member.organizationSlug}
            </span>
          </p>
        </div>
        <div className="sm:text-right sm:shrink-0">
          <StatusPill label={data.chatbotStatus.label} tone={statusTone} />
          <p className="caption text-sm max-w-sm sm:ml-auto mt-2">
            {data.chatbotStatus.detail}
          </p>
        </div>
      </header>

      {data.usageUpgrade ? (
        <UpgradePrompt
          compact
          title={data.usageUpgrade.title}
          detail={data.usageUpgrade.detail}
          ctaLabel={data.usageUpgrade.ctaLabel}
          href={data.usageUpgrade.href}
        />
      ) : null}

      {/* Alerts — only when something needs attention */}
      {data.alerts.length > 0 ? (
        <section className="space-y-3" aria-label="Alerts">
          {data.alerts.map((alert) => (
            <div
              key={alert.id}
              className="ink-card p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor:
                  alert.tone === "critical" ? "var(--red)" : "var(--ink)",
              }}
            >
              <div className="space-y-1">
                <h3 className="text-base">{alert.title}</h3>
                <p className="caption text-sm">{alert.detail}</p>
              </div>
              <Link
                href={alert.href}
                className="btn-ink bg-[var(--ink)] text-white px-4 py-2 text-xs whitespace-nowrap"
              >
                {alert.actionLabel}
              </Link>
            </div>
          ))}
        </section>
      ) : null}

      {/* Primary next action */}
      <section id="overview-next-step" className="ink-card bg-[var(--cream)] p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <SectionLabel>Next step</SectionLabel>
          <p className="text-xl font-medium">{data.primaryAction.label}</p>
          <p className="caption text-sm">{data.primaryAction.reason}</p>
        </div>
        <Link
          href={data.primaryAction.href}
          className="btn-ink bg-[var(--blue)] text-white px-5 py-2.5 text-sm whitespace-nowrap"
        >
          Continue
        </Link>
      </section>

      {/* 2. Widget status + 3. Primary metrics */}
      <div id="overview-metrics-grid" className="grid gap-4 lg:grid-cols-5">
        <section className="ink-card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>Widget</SectionLabel>
              <h2 className="text-2xl mt-1">{data.widget.name}</h2>
            </div>
            <StatusPill
              label={data.widget.activeKey ? "Key live" : "No key"}
              tone={data.widget.activeKey ? "ok" : "bad"}
            />
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="caption">Proactive tips</dt>
              <dd>{data.widget.proactiveEnabled ? "On" : "Off"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="caption">Connected domains</dt>
              <dd className="text-right">
                {data.widget.domains.length > 0
                  ? data.widget.domains.slice(0, 2).join(", ")
                  : "Any (unrestricted)"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="caption">Last seen</dt>
              <dd>{data.widget.lastSeenLabel}</dd>
            </div>
          </dl>

          {!data.widget.activeKey || !data.widget.lastSeenAt ? (
            <Link
              href="/dashboard/settings?section=developer"
              className="btn-ink bg-white px-4 py-2 text-xs inline-block"
            >
              {!data.widget.activeKey
                ? "Fix API key"
                : "Finish embedding"}
            </Link>
          ) : (
            <Link
              href="/dashboard/widget"
              className="btn-ink bg-white px-4 py-2 text-xs inline-block"
            >
              Edit chatbot
            </Link>
          )}
        </section>

        <section className="lg:col-span-3 grid gap-4 sm:grid-cols-3">
          <div className="ink-card p-5 space-y-2">
            <SectionLabel>AI credits</SectionLabel>
            <p className="text-3xl font-medium tabular-nums">
              {data.metrics.aiCreditsUsed}
              <span className="text-lg font-normal opacity-50">
                {" "}
                / {data.metrics.aiCreditsLimit}
              </span>
            </p>
            <p className="caption text-sm">
              {data.metrics.aiCreditsRemaining} included left
            </p>
            <div className="h-1.5 rounded-full bg-[var(--cream)] border border-[var(--ink)]/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${usagePct}%`,
                  background:
                    usagePct >= 90
                      ? "var(--red)"
                      : usagePct >= 75
                        ? "var(--yellow)"
                        : "var(--ink)",
                }}
              />
            </div>
            <Link
              href="/dashboard/usage"
              className="caption text-sm underline underline-offset-4"
            >
              View Usage
            </Link>
          </div>

          <div className="ink-card p-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <SectionLabel>Proactive engagement</SectionLabel>
              <StatusPill
                label={data.proactive.enabled ? "Enabled" : "Disabled"}
                tone={data.proactive.enabled ? "ok" : "warn"}
              />
            </div>
            <p className="text-sm font-medium">Suggestion performance</p>
            <p className="text-3xl font-medium tabular-nums">
              {data.proactive.activityCount}
            </p>
            <p className="caption text-sm">Suggestion activity this period</p>
          </div>

          <div className="ink-card p-5 space-y-2">
            <SectionLabel>Plan</SectionLabel>
            <p className="text-3xl font-medium">{data.metrics.planName}</p>
            <p className="caption text-sm">
              {data.metrics.planPriceLabel} · billed monthly
            </p>
            <Link
              href="/dashboard/settings?section=billing"
              className="caption text-sm underline underline-offset-4"
            >
              Billing details
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity */}
        <section className="ink-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl">Recent activity</h2>
            <Link
              href="/dashboard/conversations"
              className="caption text-sm underline underline-offset-4"
            >
              View all
            </Link>
          </div>
          {data.activity.length === 0 ? (
            <p className="caption text-sm">
              Conversations, agents, and suggestion activity will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--ink)] border-t border-[var(--ink)]">
              {data.activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href ?? "/dashboard"}
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:opacity-80"
                  >
                    <span>{item.label}</span>
                    <span className="caption text-xs whitespace-nowrap">
                      {item.at
                        ? item.at.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 6. Setup checklist — only when incomplete */}
        {!data.setupComplete ? (
          <section className="ink-card p-6 space-y-4">
            <div>
              <SectionLabel>Setup</SectionLabel>
              <h2 className="text-xl mt-1">Finish getting live</h2>
            </div>
            <ul className="space-y-3">
              {data.checklist.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 text-sm hover:opacity-80"
                  >
                    <span
                      className="mt-0.5 inline-flex size-5 flex-none items-center justify-center rounded-full border border-[var(--ink)] text-[0.65rem]"
                      style={{
                        background: item.done ? "var(--green)" : "white",
                        color: item.done ? "white" : "var(--ink)",
                      }}
                      aria-hidden
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span
                      className={
                        item.done ? "caption line-through opacity-70" : ""
                      }
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="ink-card p-6 space-y-3">
            <SectionLabel>Setup</SectionLabel>
            <h2 className="text-xl">You&apos;re live</h2>
            <p className="caption text-sm">
              API key, knowledge, and widget traffic look good. Keep refining the
              chatbot experience.
            </p>
            <Link
              href="/dashboard/widget"
              className="btn-ink bg-white px-4 py-2 text-xs inline-block"
            >
              Customize chatbot
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
