"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";

type Meter = {
  ok: boolean;
  hardCap?: boolean;
  thresholdExceeded?: boolean;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  reserved?: number;
};

type UsagePayload = {
  plan: string;
  planName: string;
  planPriceLabel: string;
  period: { start: string; end: string | null };
  policy: {
    classQueryLimits: {
      simple: number;
      standard: number;
      complex: number;
    };
    oneWayBorrowing: boolean;
    exhaustedClassFallback: "simple";
    onDemand: boolean;
  };
  blocked: { reason: string } | null;
  credits: {
    used: number;
    remaining: number;
    granted: number;
    reserved: number;
    onDemandUsed: number;
    totalUsed: number;
    conversations: number;
    averagePerConversation: number;
    byClass: Array<{
      complexityClass: string;
      label: string;
      explanation?: string;
      conversations: number;
      credits: number;
    }>;
    meter: Meter;
  };
  workloads: {
    simple: Meter;
    standard: Meter;
    complex: Meter;
  };
  allowance: {
    aiCredits: Meter;
    proactive: Meter;
    websitePages: Meter;
  };
  nearLimit: boolean;
  upgradePrompt: {
    title: string;
    detail: string;
    ctaLabel: string;
    href: string;
  } | null;
  trend: {
    days: number;
    points: Array<{ date: string; credits: number; conversations: number }>;
  };
};

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

function formatPeriod(start: string, end: string | null) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (!end) return `Started ${s}`;
  return `${s} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Customer usage — shared credits and soft workload planning thresholds. */
export function UsagePanel() {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/usage?trendDays=30");
    const json = (await res.json()) as {
      success: boolean;
      data?: UsagePayload;
      error?: string;
    };
    if (json.success && json.data) {
      setData(json.data);
      setMessage(null);
    } else setMessage(json.error ?? "Failed to load usage");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const credits = data?.credits;
  const points = data?.trend.points ?? [];
  const maxCredits = Math.max(1, ...points.map((p) => p.credits));
  const classCreditTotal = (credits?.byClass ?? []).reduce(
    (sum, row) => sum + row.credits,
    0,
  );

  return (
    <div id="usage-panel" className="space-y-5">
      <header className="space-y-1">
        <h1 id="usage-heading" className="text-3xl sm:text-4xl">Usage</h1>
        <p className="caption text-sm">
          AI credit and conversation usage for this billing period. Billing is
          in{" "}
          <Link
            href="/dashboard/settings?section=billing"
            className="underline underline-offset-4"
          >
            Settings → Billing
          </Link>
          .
        </p>
      </header>

      {data?.upgradePrompt ? (
        <UpgradePrompt
          compact
          title={data.upgradePrompt.title}
          detail={data.upgradePrompt.detail}
          ctaLabel={data.upgradePrompt.ctaLabel}
          href={data.upgradePrompt.href}
        />
      ) : data?.blocked ? (
        <div className="ink-card px-4 py-3 bg-[var(--red)]/15 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-medium">This period is capped.</span>{" "}
            {data.blocked.reason === "credits"
              ? "Included AI credits are exhausted."
              : "Included AI credits are exhausted."}{" "}
            Upgrade to continue.
          </p>
          <Link
            href="/dashboard/settings?section=billing"
            className="btn-ink text-xs px-3 py-1.5"
          >
            Upgrade
          </Link>
        </div>
      ) : data?.nearLimit ? (
        <div className="ink-card px-4 py-3 bg-[var(--yellow)]/40 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-medium">
              You are close to exhausting included AI credits.
            </span>{" "}
            {data.policy.onDemand
              ? "When included credits run out, paid plans continue on metered overage."
              : "Chat stops on the next request after included credits run out."}
          </p>
          <Link
            href="/dashboard/settings?section=billing"
            className="btn-ink text-xs px-3 py-1.5"
          >
            Upgrade
          </Link>
        </div>
      ) : null}

      <section id="usage-metrics-row" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="ink-card p-4 space-y-1.5">
          <Label>Plan</Label>
          <p className="text-2xl font-medium">
            {data?.planName ?? (loading ? "…" : "—")}
          </p>
          <p className="caption text-[0.65rem] opacity-70">
            {data?.planPriceLabel ?? "—"} ·{" "}
            {data ? formatPeriod(data.period.start, data.period.end) : "—"}
          </p>
          <p className="text-sm tabular-nums">
            {credits ? credits.granted.toLocaleString() : loading ? "…" : "—"}{" "}
            included credits
          </p>
        </div>
        <div className="ink-card p-4 space-y-1">
          <Label>Credits used</Label>
          <p className="text-2xl font-medium tabular-nums">
            {credits ? credits.used.toLocaleString() : loading ? "…" : "—"}
          </p>
          {credits && credits.onDemandUsed > 0 ? (
            <p className="caption text-[0.65rem] opacity-70">
              +{credits.onDemandUsed.toLocaleString()} metered overage
            </p>
          ) : null}
        </div>
        <div className="ink-card p-4 space-y-1">
          <Label>Credits remaining</Label>
          <p className="text-2xl font-medium tabular-nums">
            {credits ? credits.remaining.toLocaleString() : loading ? "…" : "—"}
          </p>
        </div>
        <div className="ink-card p-4 space-y-1">
          <Label>Conversations</Label>
          <p className="text-2xl font-medium tabular-nums">
            {credits
              ? credits.conversations.toLocaleString()
              : loading
                ? "…"
                : "—"}
          </p>
          <p className="caption text-[0.65rem] opacity-70">
            Charged after a reply is delivered
          </p>
        </div>
      </section>

      <section className="ink-card px-4 py-3 sm:px-5 space-y-3">
        {credits?.byClass.length ? (
          <ul className="space-y-2.5">
            {credits.byClass.map((row) => {
              const share =
                classCreditTotal > 0
                  ? Math.round((row.credits / classCreditTotal) * 100)
                  : 0;
              return (
                <li key={row.complexityClass} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">{row.label}</span>
                    <dl className="flex gap-5 text-right">
                      <div>
                        <dd className="tabular-nums">
                          {row.conversations.toLocaleString()}
                        </dd>
                        <dt className="caption text-[0.65rem]">
                          conversations
                        </dt>
                      </div>
                      <div>
                        <dd className="tabular-nums">
                          {row.credits.toLocaleString()}
                        </dd>
                        <dt className="caption text-[0.65rem]">
                          credits charged
                        </dt>
                      </div>
                    </dl>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[var(--cream)] overflow-hidden border border-[var(--ink)]/10">
                      <div
                        className="h-full bg-[var(--ink)]"
                        style={{ width: `${share}%`, opacity: 0.75 }}
                      />
                    </div>
                    <span className="caption text-[0.65rem] tabular-nums w-9 text-right">
                      {share}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="caption text-sm">No credit usage yet this period.</p>
        )}
      </section>

      <section className="ink-card px-4 py-3 sm:px-5 space-y-3">
        <div>
          <Label>Credit usage over time</Label>
          <p className="caption text-[0.65rem] mt-0.5">
            AI credits per day · last 30 days
          </p>
        </div>
        {points.length ? (
          <>
            <div className="flex items-end gap-[3px] h-28 w-full" role="img">
              {points.map((p) => {
                const fill =
                  p.credits > 0
                    ? Math.max(6, Math.round((p.credits / maxCredits) * 100))
                    : 0;
                return (
                  <div
                    key={p.date}
                    className="relative flex-1 min-w-0 h-full rounded-[3px] bg-[var(--ink)]/[0.07] overflow-hidden"
                    title={`${formatDay(p.date)}: ${p.credits} credits · ${p.conversations} chats`}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-[3px] bg-[var(--ink)] transition-[height] duration-300"
                      style={{
                        height: fill > 0 ? `${fill}%` : "3px",
                        opacity: fill > 0 ? 0.85 : 0.25,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="caption text-[0.65rem]">
                {formatDay(points[0]!.date)}
              </span>
              <span className="caption text-[0.65rem]">
                {points.reduce((s, p) => s + p.credits, 0).toLocaleString()}{" "}
                credits · peak {maxCredits.toLocaleString()}/day
              </span>
              <span className="caption text-[0.65rem]">
                {formatDay(points[points.length - 1]!.date)}
              </span>
            </div>
          </>
        ) : (
          <p className="caption text-sm">No trend data yet.</p>
        )}
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </div>
  );
}
