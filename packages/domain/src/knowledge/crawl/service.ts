import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  knowledgeDocuments,
  knowledgeSources,
  organizationIntegrations,
  websiteCrawlJobs,
  websiteCrawlPages,
  type WebsiteCrawlJobMode,
} from "@neylonai/database";
import { verifyWebsiteUrl } from "@neylonai/integrations/website";
import { ApiAuthError } from "../../billing/keys";
import { clampWebsiteMaxPages, getPlanEntitlements } from "../../billing/plans";
import { assertCanEnableIntegration } from "../../billing/checks";
import {
  getWebsiteCrawlBudgetUsage,
  releaseWebsiteCrawlBudget,
} from "./budget";
import {
  ACTIVE_CRAWL_STATUSES,
  STALE_CRAWL_MS,
  utcYearMonth,
  websiteReimportAvailableAt,
} from "./helpers";
import {
  createWebsiteSource,
  ensureOrganizationIntegrationRow,
} from "../service";
import { MAIN_AGENT_KEY } from "../../agents/org-agents.types";

export type WebsiteCrawlJobView = {
  id: string;
  status: string;
  mode: WebsiteCrawlJobMode;
  seedUrl: string;
  maxPages: number;
  knowledgeSourceId: string | null;
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
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
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

function mapJob(
  job: typeof websiteCrawlJobs.$inferSelect,
  pages: Array<typeof websiteCrawlPages.$inferSelect> = [],
): WebsiteCrawlJobView {
  return {
    id: job.id,
    status: job.status,
    mode: job.mode as WebsiteCrawlJobMode,
    seedUrl: job.seed_url,
    maxPages: job.max_pages,
    knowledgeSourceId: job.knowledge_source_id,
    source: job.source,
    found: job.found_count,
    eligible: job.eligible_count,
    selected: job.selected_count,
    scraped: job.scraped_count,
    skipped: job.skipped_count,
    failed: job.failed_count,
    categories: {},
    error: job.error,
    provider: job.provider,
    createdAt: job.created_at?.toISOString() ?? null,
    startedAt: job.started_at?.toISOString() ?? null,
    finishedAt: job.finished_at?.toISOString() ?? null,
    pages: pages.map((page) => ({
      url: page.url,
      path: page.canonical_path,
      status: page.status,
      category: page.category,
      error: page.error,
      errorCode: null,
      httpStatus: page.http_status,
      provider: page.provider,
      lastmod: page.lastmod,
    })),
  };
}

function configUrl(
  config: Record<string, unknown> | null | undefined,
): string | null {
  const url = config?.url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function safeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

async function websiteIntegrationRow(organizationId: string) {
  const [row] = await db
    .select()
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, organizationId),
        eq(organizationIntegrations.integration_id, "website"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getWebsiteCrawlEntitlements(input: {
  organizationId: string;
  plan: string;
}) {
  const entitlements = getPlanEntitlements(input.plan);
  const yearMonth = utcYearMonth();
  const usage = await getWebsiteCrawlBudgetUsage(
    input.organizationId,
    yearMonth,
  );
  const remaining = Math.max(0, entitlements.websitePagesPerMonth - usage.used);
  const [stored] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeDocuments)
    .innerJoin(
      knowledgeSources,
      eq(knowledgeSources.id, knowledgeDocuments.source_id),
    )
    .innerJoin(
      organizationIntegrations,
      eq(
        organizationIntegrations.id,
        knowledgeSources.organization_integration_id,
      ),
    )
    .where(
      and(
        eq(knowledgeDocuments.organization_id, input.organizationId),
        eq(organizationIntegrations.integration_id, "website"),
      ),
    );
  const row = await websiteIntegrationRow(input.organizationId);
  const configured = Number(
    (row?.config as Record<string, unknown> | null)?.maxPages,
  );
  return {
    planId: entitlements.planId,
    websitePagesPerSync: entitlements.websitePagesPerSync,
    websitePagesPerMonth: entitlements.websitePagesPerMonth,
    monthlyReserved: usage.reserved,
    monthlyConsumed: usage.consumed,
    monthlyUsed: usage.used,
    monthlyRemaining: remaining,
    storedPages: Number(stored?.n ?? 0),
    maxPages: Number.isFinite(configured)
      ? clampWebsiteMaxPages(input.plan, configured)
      : entitlements.websitePagesPerSync,
  };
}

export async function startWebsiteCrawl(input: {
  organizationId: string;
  plan: string;
  url?: string;
  maxPages?: number;
  mode?: WebsiteCrawlJobMode;
}): Promise<WebsiteCrawlJobView> {
  await assertCanEnableIntegration(
    { organizationId: input.organizationId, plan: input.plan },
    "website",
  );

  const existing = await websiteIntegrationRow(input.organizationId);
  const requestedUrl =
    input.url?.trim() ||
    configUrl((existing?.config as Record<string, unknown>) ?? {}) ||
    "";
  if (!requestedUrl) throw new Error("A public URL is required.");

  const reimportAvailableAt = websiteReimportAvailableAt(
    (existing?.config as Record<string, unknown> | null) ?? {},
  );
  if (existing && !existing.enabled && reimportAvailableAt) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Website content was deleted recently. You can import it again after ${reimportAvailableAt.toLocaleString()}.`,
      409,
    );
  }

  // Reject unreachable, unresolvable, or non-https sites before any job,
  // integration row, or knowledge source is created.
  const verified = await verifyWebsiteUrl(requestedUrl);
  const url = verified.url;

  const maxPages = clampWebsiteMaxPages(input.plan, input.maxPages);
  const entitlements = getPlanEntitlements(input.plan);
  const previousUrl = configUrl(
    (existing?.config as Record<string, unknown> | null) ?? {},
  );
  let mode: WebsiteCrawlJobMode =
    input.mode ??
    (existing?.enabled &&
    previousUrl &&
    safeOrigin(previousUrl) === verified.origin
      ? "refresh"
      : "initial");

  const active = existing
    ? await db
        .select({ id: websiteCrawlJobs.id, status: websiteCrawlJobs.status })
        .from(websiteCrawlJobs)
        .where(
          and(
            eq(websiteCrawlJobs.organization_id, input.organizationId),
            eq(websiteCrawlJobs.organization_integration_id, existing.id),
            inArray(websiteCrawlJobs.status, [...ACTIVE_CRAWL_STATUSES]),
          ),
        )
        .limit(1)
    : [];
  if (active[0]) {
    const [stale] = await db
      .select()
      .from(websiteCrawlJobs)
      .where(eq(websiteCrawlJobs.id, active[0].id))
      .limit(1);
    if (!stale || !(await settleStuckCancellation(stale))) {
      throw new ApiAuthError(
        "entitlement_denied",
        "A website crawl is already running. Cancel it or wait for it to finish.",
        409,
      );
    }
  }

  const yearMonth = utcYearMonth();

  const organizationIntegrationId = await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "website",
    enabled: true,
    config: {
      url,
      maxPages,
      accountLabel: url,
      reimportAvailableAt: null,
    },
  });

  const source = await createWebsiteSource({
    organizationId: input.organizationId,
    url,
    agentIds: [MAIN_AGENT_KEY],
  });

  const [job] = await db
    .insert(websiteCrawlJobs)
    .values({
      organization_id: input.organizationId,
      organization_integration_id: organizationIntegrationId,
      knowledge_source_id: source.id,
      seed_url: url,
      max_pages: maxPages,
      status: "queued",
      mode,
      budget_limit: entitlements.websitePagesPerMonth,
      year_month: yearMonth,
    })
    .returning();

  if (mode === "retry_failed") {
    const [previous] = await db
      .select()
      .from(websiteCrawlJobs)
      .where(
        and(
          eq(websiteCrawlJobs.organization_id, input.organizationId),
          inArray(websiteCrawlJobs.status, ["completed", "failed"]),
        ),
      )
      .orderBy(desc(websiteCrawlJobs.created_at))
      .limit(1);
    const failedPages = previous
      ? await db
          .select()
          .from(websiteCrawlPages)
          .where(
            and(
              eq(websiteCrawlPages.job_id, previous.id),
              inArray(websiteCrawlPages.status, ["failed", "not_found"]),
            ),
          )
      : [];
    if (failedPages.length === 0) {
      await db.delete(websiteCrawlJobs).where(eq(websiteCrawlJobs.id, job!.id));
      throw new Error("There are no failed website pages to retry.");
    }
    await db.insert(websiteCrawlPages).values(
      failedPages.map((page) => ({
        job_id: job!.id,
        organization_id: input.organizationId,
        url: page.url,
        canonical_path: page.canonical_path,
        lastmod: page.lastmod,
        category: page.category,
        status: "selected" as const,
        retry_count: page.retry_count,
      })),
    );
    mode = "retry_failed";
    await db
      .update(websiteCrawlJobs)
      .set({
        selected_count: failedPages.length,
        found_count: failedPages.length,
        eligible_count: failedPages.length,
      })
      .where(eq(websiteCrawlJobs.id, job!.id));
  }

  try {
    const { enqueueWebsiteCrawlJob } =
      await import("@neylonai/domain/knowledge/crawl-queue");
    await enqueueWebsiteCrawlJob(job!.id);
  } catch (error) {
    await db
      .update(websiteCrawlJobs)
      .set({
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Failed to enqueue crawl job",
        finished_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(websiteCrawlJobs.id, job!.id));
    throw error;
  }

  return mapJob(job!);
}

export async function getWebsiteCrawlJob(input: {
  organizationId: string;
  jobId: string;
}): Promise<WebsiteCrawlJobView | null> {
  const [job] = await db
    .select()
    .from(websiteCrawlJobs)
    .where(
      and(
        eq(websiteCrawlJobs.id, input.jobId),
        eq(websiteCrawlJobs.organization_id, input.organizationId),
      ),
    )
    .limit(1);
  if (!job) return null;
  if (await settleStuckCancellation(job)) {
    return await getWebsiteCrawlJob(input);
  }
  const pages = await db
    .select()
    .from(websiteCrawlPages)
    .where(eq(websiteCrawlPages.job_id, job.id));
  return mapJob(job, pages);
}

export async function getLatestWebsiteCrawl(
  organizationId: string,
): Promise<WebsiteCrawlJobView | null> {
  const [job] = await db
    .select()
    .from(websiteCrawlJobs)
    .where(eq(websiteCrawlJobs.organization_id, organizationId))
    .orderBy(desc(websiteCrawlJobs.created_at))
    .limit(1);
  if (!job) return null;
  if (await settleStuckCancellation(job)) {
    return await getLatestWebsiteCrawl(organizationId);
  }
  const pages = await db
    .select()
    .from(websiteCrawlPages)
    .where(eq(websiteCrawlPages.job_id, job.id));
  return mapJob(job, pages);
}

export async function cancelWebsiteCrawl(input: {
  organizationId: string;
  jobId: string;
}): Promise<WebsiteCrawlJobView | null> {
  const [job] = await db
    .select()
    .from(websiteCrawlJobs)
    .where(
      and(
        eq(websiteCrawlJobs.id, input.jobId),
        eq(websiteCrawlJobs.organization_id, input.organizationId),
      ),
    )
    .limit(1);
  if (!job) return null;
  if (
    !ACTIVE_CRAWL_STATUSES.includes(
      job.status as (typeof ACTIVE_CRAWL_STATUSES)[number],
    )
  ) {
    return mapJob(job);
  }
  await db
    .update(websiteCrawlJobs)
    .set({ status: "cancelling", updated_at: new Date() })
    .where(eq(websiteCrawlJobs.id, job.id));

  // Stop is authoritative: settle the job here instead of parking it in
  // `cancelling` while waiting on a worker that may be busy, unreachable, or
  // not running at all. A worker still holding the job sees the status within
  // a second, aborts its in-flight scrape, and cannot revive a cancelled row.
  await dropQueuedCrawl(job.id);
  await settleCancelledCrawl(job);

  return await getWebsiteCrawlJob(input);
}

async function dropQueuedCrawl(jobId: string): Promise<void> {
  try {
    const { getWebsiteCrawlQueue } =
      await import("@neylonai/domain/knowledge/crawl-queue");
    const queued = await getWebsiteCrawlQueue().getJob(jobId);
    if (!queued || (await queued.isActive())) return;
    await queued.remove();
  } catch (error) {
    console.warn("[crawler] failed to remove queued job", jobId, error);
  }
}

/**
 * Any row left in `cancelling` belongs to a worker that died or never picked
 * the job up, so settle it rather than letting the dashboard poll forever.
 */
async function settleStuckCancellation(
  job: typeof websiteCrawlJobs.$inferSelect,
): Promise<boolean> {
  if (job.status !== "cancelling") return false;
  await settleCancelledCrawl(job);
  return true;
}

async function settleCancelledCrawl(
  job: typeof websiteCrawlJobs.$inferSelect,
): Promise<void> {
  const leftover = Math.max(
    0,
    job.reserved_pages - job.consumed_pages - job.released_pages,
  );
  if (leftover > 0) {
    await releaseWebsiteCrawlBudget({
      organizationId: job.organization_id,
      yearMonth: job.year_month,
      pages: leftover,
    });
  }
  await db
    .update(websiteCrawlPages)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(
      and(
        eq(websiteCrawlPages.job_id, job.id),
        eq(websiteCrawlPages.status, "selected"),
      ),
    );
  await db
    .update(websiteCrawlJobs)
    .set({
      status: "cancelled",
      released_pages: job.released_pages + leftover,
      finished_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(websiteCrawlJobs.id, job.id));
}

export async function recoverStaleWebsiteCrawlJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_CRAWL_MS);
  const stale = await db
    .select({ id: websiteCrawlJobs.id })
    .from(websiteCrawlJobs)
    .where(
      and(
        inArray(websiteCrawlJobs.status, ["queued", "discovering", "crawling"]),
        lt(websiteCrawlJobs.updated_at, cutoff),
      ),
    );
  for (const job of stale) {
    try {
      const { enqueueWebsiteCrawlJob } =
        await import("@neylonai/domain/knowledge/crawl-queue");
      await enqueueWebsiteCrawlJob(job.id);
    } catch (error) {
      console.warn("[crawler] failed to re-enqueue stale job", job.id, error);
    }
  }
  return stale.length;
}
