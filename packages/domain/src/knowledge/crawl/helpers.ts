export function utcYearMonth(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function fitsWebsiteCrawlBudget(
  reserved: number,
  consumed: number,
  add: number,
  limit: number,
): boolean {
  if (add < 0) return false;
  if (add === 0) return true;
  return reserved + consumed + add <= limit;
}

/** Initial imports and failed-page retries do not use monthly refreshes. */
export function usesWebsiteRefreshBudget(mode: string): boolean {
  return mode === "refresh";
}

/**
 * A refresh only costs the monthly unit when it finishes. Cancelled and failed
 * runs give the reservation back so provider or model errors are not billed.
 */
export function websiteRefreshBudgetSettlement(
  status: "completed" | "failed" | "cancelled",
): "consume" | "release" {
  return status === "completed" ? "consume" : "release";
}

export const WEBSITE_REIMPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function websiteReimportAvailableAt(
  config: Record<string, unknown> | null | undefined,
  now = Date.now(),
): Date | null {
  const raw = config?.reimportAvailableAt;
  if (typeof raw !== "string") return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp) || timestamp <= now) return null;
  return new Date(timestamp);
}

export function parseLastmod(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

/** Skip scrape only when both sides have a parseable lastmod and they match. */
export function lastmodUnchanged(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): boolean {
  const previous = parseLastmod(existing);
  const next = parseLastmod(incoming);
  if (!previous || !next) return false;
  return previous.getTime() === next.getTime();
}

export function refreshPageDecision(input: {
  hasStoredPage: boolean;
  storedLastmod?: string | null;
  discoveredLastmod?: string | null;
}): "scrape" | "skip_lastmod" | "skip_existing" {
  if (!input.hasStoredPage) return "scrape";
  if (lastmodUnchanged(input.storedLastmod, input.discoveredLastmod)) {
    return "skip_lastmod";
  }
  return input.discoveredLastmod ? "scrape" : "skip_existing";
}

export function documentsToRemove(
  existingPaths: Array<string | null | undefined>,
  selectedPaths: string[],
): string[] {
  const keep = new Set(selectedPaths);
  return existingPaths.filter((path): path is string => {
    if (!path) return false;
    return !keep.has(path);
  });
}

export const ACTIVE_CRAWL_STATUSES = [
  "queued",
  "discovering",
  "crawling",
  "cancelling",
] as const;

export const STALE_CRAWL_MS = 15 * 60 * 1000;

export const DEFAULT_PAGE_CONCURRENCY = 3;
