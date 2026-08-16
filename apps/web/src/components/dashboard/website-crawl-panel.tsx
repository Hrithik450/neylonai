"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";

type CrawlJob = {
  id: string;
  status: string;
  mode: "initial" | "refresh" | "retry_failed";
  seedUrl: string;
  maxPages: number;
  source: string | null;
  found: number;
  eligible: number;
  selected: number;
  scraped: number;
  skipped: number;
  failed: number;
  categories: Record<string, number>;
  error: string | null;
  provider: string | null;
  pages: Array<{
    url: string;
    path: string;
    status: string;
    category: string | null;
    error: string | null;
    errorCode: string | null;
    httpStatus: number | null;
    provider: string | null;
    lastmod: string | null;
  }>;
};

type Entitlements = {
  planId: string;
  websitePagesPerSync: number;
  websitePagesPerMonth: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  storedPages: number;
  maxPages: number;
};

const ACTIVE = new Set(["queued", "discovering", "crawling", "cancelling"]);

const DOMAIN_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/**
 * The page cap is a ceiling, not a target, so it is never used as a
 * denominator. A total only appears once discovery knows how many pages
 * this run will actually fetch.
 */
function progressLabel(job: CrawlJob): string {
  if (job.status === "queued") return "Waiting to start…";
  if (job.status === "discovering") return "Finding useful pages on your site…";
  if (job.status === "cancelling") return "Stopping import…";
  const done = job.scraped + job.skipped + job.failed;
  if (job.selected > 0) {
    return `Importing pages (${done.toLocaleString()} of ${job.selected.toLocaleString()})`;
  }
  return done > 0
    ? `Importing pages (${done.toLocaleString()} so far)`
    : "Importing pages…";
}

function pageStatusLabel(status: string): string {
  if (status === "skipped_lastmod") return "already scraped";
  return status.replace(/_/g, " ");
}

/** Mirrors the server gate so obvious typos fail before a request. */
function websiteUrlIssue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) {
    return "Website address can’t contain spaces.";
  }
  const scheme = trimmed
    .match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]
    ?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    return "Only https:// website addresses can be imported.";
  }
  let parsed: URL;
  try {
    parsed = new URL(scheme ? trimmed : `https://${trimmed}`);
  } catch {
    return "Enter a valid website address, like https://acme.com.";
  }
  if (!DOMAIN_RE.test(parsed.hostname)) {
    return `“${parsed.hostname}” is not a valid domain name.`;
  }
  return null;
}

export function WebsiteCrawlPanel({
  enabled,
  initialUrl,
  reimportAvailableAt,
  busy: parentBusy = false,
  onDisconnected,
  onConnectionChanged,
}: {
  enabled: boolean;
  initialUrl: string;
  reimportAvailableAt?: string | null;
  busy?: boolean;
  onDisconnected: () => Promise<void>;
  onConnectionChanged?: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [maxPages, setMaxPages] = useState(8);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [busy, setBusy] = useState<"crawl" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState<
    "all" | "imported" | "skipped" | "errors"
  >("all");
  const [showCompletionNotice, setShowCompletionNotice] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const previousJobStatus = useRef<string | null>(null);

  const configuredMax = entitlements?.maxPages;
  useEffect(() => {
    if (configuredMax) setMaxPages(configuredMax);
  }, [configuredMax]);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/integrations/website/crawl");
    const json = (await res.json()) as {
      success: boolean;
      data?: { job: CrawlJob | null; entitlements: Entitlements };
      error?: string;
    };
    if (!json.success || !json.data) {
      throw new Error(json.error ?? "Failed to load website crawl status.");
    }
    setJob(json.data.job);
    setEntitlements(json.data.entitlements);
    if (!initialUrl && json.data.job?.seedUrl) {
      setUrl(json.data.job.seedUrl);
    }
    return json.data;
  }, [initialUrl]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load crawl.");
    });
  }, [load]);

  const active = job ? ACTIVE.has(job.status) : false;

  useEffect(() => {
    const next = job?.status ?? null;
    const previous = previousJobStatus.current;
    if (
      job &&
      next === "completed" &&
      previous !== null &&
      previous !== "completed"
    ) {
      setShowCompletionNotice(true);
      // The worker enables the integration, so the page's connected state
      // (Import vs Refresh, Disconnect) is stale until the parent reloads.
      onConnectionChanged?.();
    }
    previousJobStatus.current = next;
  }, [job, job?.status, onConnectionChanged]);

  useEffect(() => {
    if (!showCompletionNotice) return;
    const timer = window.setTimeout(() => {
      setShowCompletionNotice(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [showCompletionNotice, job?.id]);

  useEffect(() => {
    if (!active || !job) return;
    const id = window.setInterval(
      () => {
        void load().catch(() => undefined);
      },
      job.status === "cancelling" ? 1000 : 2500,
    );
    return () => window.clearInterval(id);
  }, [active, job, load]);

  const planMax = entitlements?.websitePagesPerSync ?? 8;
  const remaining = entitlements?.monthlyRemaining ?? 0;
  const refreshesPerMonth = entitlements?.websitePagesPerMonth ?? 1;
  const refreshesUsed = entitlements?.monthlyUsed ?? 0;
  const reimportTimestamp = reimportAvailableAt
    ? Date.parse(reimportAvailableAt)
    : Number.NaN;
  const reimportLocked =
    !enabled && Number.isFinite(reimportTimestamp) && reimportTimestamp > now;
  const urlIssue = useMemo(() => websiteUrlIssue(url), [url]);

  useEffect(() => {
    if (!reimportLocked) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [reimportLocked]);

  const startCrawl = async (mode?: "initial" | "refresh" | "retry_failed") => {
    if (!url.trim()) {
      setError("Enter a public website URL to crawl.");
      return;
    }
    if (urlIssue) {
      setError(urlIssue);
      return;
    }
    setBusy("crawl");
    setError(null);
    setShowCompletionNotice(false);
    try {
      const res = await fetch("/api/v1/integrations/website/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          maxPages,
          ...(mode ? { mode } : {}),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { job: CrawlJob };
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Failed to start crawl.");
      }
      setJob(json.data.job);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start crawl.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!job) return;
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/v1/integrations/website/crawl/${job.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { job: CrawlJob };
      };
      if (!json.success) throw new Error(json.error ?? "Cancel failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setBusy(null);
    }
  };

  const showUpgrade = enabled && entitlements != null && remaining === 0;
  const erroredPages =
    job?.pages.filter((page) =>
      ["failed", "not_found"].includes(page.status),
    ) ?? [];
  const visiblePages =
    job?.pages.filter((page) => {
      if (pageFilter === "all") return true;
      if (pageFilter === "imported") return page.status === "scraped";
      if (pageFilter === "errors") {
        return ["failed", "not_found"].includes(page.status);
      }
      return page.status.startsWith("skipped_");
    }) ?? [];

  return (
    <div className="space-y-3 border-t border-[var(--ink)]/10 pt-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Website URL</span>
        <input
          className="ink-input w-full text-sm"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          disabled={busy !== null || active}
        />
        <span className="caption text-[0.65rem] block">
          {urlIssue ??
            "Only secure (https) websites that resolve can be imported."}
        </span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Page cap</span>
        <input
          type="number"
          min={1}
          max={planMax}
          className="ink-input w-full text-sm"
          value={maxPages}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            setMaxPages(Math.max(1, Math.min(planMax, Math.floor(next))));
          }}
          disabled={busy !== null || active}
        />
        <span className="caption text-[0.65rem] block space-y-0.5">
          <span className="block">
            Up to {planMax.toLocaleString()} pages per import.
          </span>
          <span className="block">
            Monthly refreshes{" "}
            <span className="ml-1">
              {refreshesUsed.toLocaleString()} /{" "}
              {refreshesPerMonth.toLocaleString()}
            </span>
            <span className="ml-2">({remaining.toLocaleString()} left).</span>
          </span>
          {reimportLocked ? (
            <span className="block text-red-700">
              Import available after{" "}
              {new Date(reimportTimestamp).toLocaleString()}.
            </span>
          ) : null}
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2"
          disabled={
            busy !== null ||
            active ||
            parentBusy ||
            (enabled && remaining === 0) ||
            reimportLocked ||
            !url.trim() ||
            Boolean(urlIssue)
          }
          onClick={() => void startCrawl(enabled ? "refresh" : "initial")}
        >
          {enabled ? "Refresh" : "Import"}
        </button>
        {active ? (
          <button
            type="button"
            className="btn-ink bg-white text-sm px-4 py-2"
            disabled={busy === "cancel"}
            onClick={() => void cancel()}
          >
            Stop
          </button>
        ) : null}
        {!active && erroredPages.length > 0 ? (
          <button
            type="button"
            className="btn-ink bg-white text-sm px-4 py-2"
            disabled={busy !== null}
            onClick={() => void startCrawl("retry_failed")}
          >
            Retry {erroredPages.length} errored page
            {erroredPages.length === 1 ? "" : "s"}
          </button>
        ) : null}
        {enabled ? (
          <button
            type="button"
            className="btn-ink bg-white text-sm px-4 py-2"
            disabled={busy !== null || active || parentBusy}
            onClick={() => {
              void (async () => {
                setError(null);
                setShowCompletionNotice(false);
                setJob(null);
                setEntitlements((prev) =>
                  prev
                    ? { ...prev, storedPages: 0, monthlyUsed: prev.monthlyUsed }
                    : prev,
                );
                try {
                  await onDisconnected();
                  await load();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Disconnect failed.",
                  );
                  await load().catch(() => undefined);
                }
              })();
            }}
          >
            {parentBusy ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : null}
      </div>

      {active && job ? (
        <div
          className="rounded-lg border border-[var(--ink)]/15 bg-[var(--cream)] px-3 py-2.5 space-y-1"
          role="status"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--ink)]/25 border-t-[var(--ink)] animate-spin"
              aria-hidden
            />
            {progressLabel(job)}
          </div>
          {job.found > 0 ? (
            <p className="caption text-[0.65rem]">
              Found {job.found} · useful {job.eligible} · selected{" "}
              {job.selected} · imported {job.scraped} · skipped {job.skipped} ·
              failed {job.failed}
            </p>
          ) : null}
        </div>
      ) : null}

      {showCompletionNotice && job?.status === "completed" ? (
        <p
          className="text-sm rounded-lg border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2"
          role="status"
        >
          Stored {entitlements?.storedPages ?? job.scraped} page(s) in
          knowledge. Imported {job.scraped}, skipped {job.skipped}, failed{" "}
          {job.failed}.
        </p>
      ) : null}

      {job?.pages.length ? (
        <div className="space-y-3 rounded-lg border border-[var(--ink)]/15 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Stored", entitlements?.storedPages ?? 0],
              ["Imported", job.scraped],
              ["Skipped", job.skipped],
              ["Errors", job.failed],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-[var(--cream)] px-3 py-2"
              >
                <p className="caption text-[0.65rem]">{label}</p>
                <p className="text-lg font-medium">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "imported", "skipped", "errors"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setPageFilter(filter)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${
                    pageFilter === filter
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--ink)]/15 bg-white"
                  }`}
                >
                  {filter}
                </button>
              ),
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[var(--ink)]/10">
                  <th className="py-2 pr-3 font-medium">Page</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {visiblePages.map((page) => (
                  <tr
                    key={`${page.path}:${page.status}`}
                    className="border-b border-[var(--ink)]/5 align-top"
                  >
                    <td className="max-w-64 py-2 pr-3">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all hover:underline"
                      >
                        {page.path}
                      </a>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      {pageStatusLabel(page.status)}
                    </td>
                    <td className="py-2 text-[var(--ink)]/60">
                      {page.httpStatus ? `HTTP ${page.httpStatus} · ` : ""}
                      {page.error ?? page.category ?? page.provider ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {job?.status === "failed" || error ? (
        <p
          className="text-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-900"
          role="alert"
        >
          {error || job?.error || "Crawl failed."}
        </p>
      ) : null}

      {showUpgrade ? (
        <UpgradePrompt
          compact
          title="Need more website refreshes?"
          detail="Upgrade to refresh your stored website more often."
          ctaLabel="View plans"
          href="/dashboard/billing"
        />
      ) : null}
    </div>
  );
}
