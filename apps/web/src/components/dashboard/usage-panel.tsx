"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";

type Meter = {
  ok: boolean;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
};

type UsagePayload = {
  plan: string;
  planName: string;
  planPriceLabel: string;
  period: { start: string; end: string | null };
  allowance: {
    conversations: Meter;
    proactive: Meter;
    knowledge: Meter;
    integrations: Meter;
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
    points: Array<{ date: string; conversations: number; events: number }>;
  };
};

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mono block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
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

function Progress({ percent }: { percent: number }) {
  const tone =
    percent >= 90 ? "var(--red)" : percent >= 75 ? "var(--yellow)" : "var(--ink)";
  return (
    <div className="h-1.5 rounded-full border border-[var(--ink)]/10 bg-[var(--cream)] overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, percent)}%`, background: tone }}
      />
    </div>
  );
}

function MeterCard({
  label,
  hint,
  meter,
}: {
  label: string;
  hint: string;
  meter: Meter;
}) {
  return (
    <div className="ink-card p-4 space-y-2.5 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-sm tabular-nums whitespace-nowrap">
          <span className="font-medium">{meter.used.toLocaleString()}</span>
          <span className="opacity-50"> / {meter.limit.toLocaleString()}</span>
        </p>
      </div>
      <Progress percent={meter.percent} />
      <p className="caption text-[0.65rem]">
        {meter.remaining.toLocaleString()} left · {meter.percent}%
      </p>
      <p className="caption text-[0.65rem] opacity-70 line-clamp-2">{hint}</p>
    </div>
  );
}

/** Customer usage — plan limits only (no internal COGS). */
export function UsagePanel() {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(30);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (days: 7 | 30) => {
    setLoading(true);
    const res = await fetch(`/api/v1/usage?trendDays=${days}`);
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
    void load(trendDays);
  }, [load, trendDays]);

  const conv = data?.allowance.conversations;
  const points = data?.trend.points ?? [];
  const max = Math.max(1, ...points.map((p) => p.conversations));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">Usage</h1>
        <p className="caption text-sm">
          What you&apos;ve used this period vs your plan. Billing is in{" "}
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
      ) : data?.nearLimit ? (
        <div className="ink-card px-4 py-3 bg-[var(--yellow)]/40 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-medium">Approaching your conversation limit.</span>
          </p>
          <Link
            href="/dashboard/settings?section=billing"
            className="btn-ink text-xs px-3 py-1.5"
          >
            Upgrade
          </Link>
        </div>
      ) : null}

      <section className="ink-card px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <Label>Plan</Label>
            <p className="text-lg font-medium mt-0.5">
              {data?.planName ?? (loading ? "…" : "—")}
            </p>
          </div>
          <div>
            <Label>Price</Label>
            <p className="text-sm mt-0.5">{data?.planPriceLabel ?? "—"}</p>
          </div>
          <div>
            <Label>Period</Label>
            <p className="text-sm mt-0.5">
              {data ? formatPeriod(data.period.start, data.period.end) : "—"}
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <Label>Conversations</Label>
            <p className="text-sm mt-0.5 tabular-nums">
              {conv
                ? `${conv.used.toLocaleString()} / ${conv.limit.toLocaleString()} · ${conv.percent}%`
                : loading
                  ? "…"
                  : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label>Allowances</Label>
        {data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MeterCard
              label="Conversations"
              hint="Counted this billing period"
              meter={data.allowance.conversations}
            />
            <MeterCard
              label="Proactive suggestions"
              hint="Resets daily"
              meter={data.allowance.proactive}
            />
            <MeterCard
              label="Knowledge documents"
              hint="Uploaded docs vs plan capacity"
              meter={data.allowance.knowledge}
            />
            <MeterCard
              label="Integrations"
              hint="Connected services enabled"
              meter={data.allowance.integrations}
            />
          </div>
        ) : (
          <p className="caption text-sm">{loading ? "Loading…" : "—"}</p>
        )}
      </section>

      <section className="ink-card px-4 py-3 sm:px-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label>Trend</Label>
            <p className="caption text-[0.65rem] mt-0.5">Conversations per day</p>
          </div>
          <div className="flex gap-1">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTrendDays(d)}
                className={`rounded-full border border-[var(--ink)] px-3 py-1 text-xs font-medium ${
                  trendDays === d ? "text-white" : "bg-white"
                }`}
                style={
                  trendDays === d ? { background: "var(--ink)" } : undefined
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {points.length ? (
          <>
            <div className="flex items-end gap-0.5 h-20 w-full" role="img">
              {points.map((p) => {
                const h = Math.max(3, Math.round((p.conversations / max) * 100));
                return (
                  <div
                    key={p.date}
                    className="flex-1 min-w-0 flex flex-col justify-end h-full"
                    title={`${p.date}: ${p.conversations}`}
                  >
                    <div
                      className="w-full rounded-sm border border-[var(--ink)]/20 bg-[var(--ink)]"
                      style={{
                        height: `${h}%`,
                        opacity: p.conversations === 0 ? 0.12 : 0.85,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <p className="caption text-[0.65rem]">
              {points.reduce((s, p) => s + p.conversations, 0)} conversations in{" "}
              {data?.trend.days} days
            </p>
          </>
        ) : (
          <p className="caption text-sm">No trend data yet.</p>
        )}
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </div>
  );
}
