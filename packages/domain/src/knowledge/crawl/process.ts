import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  db,
  knowledgeDocuments,
  listExistingPageSections,
  websiteCrawlJobs,
  websiteCrawlPages,
  type WebsiteCrawlJobStatus,
} from "@neylonai/database";
import {
  discoverWebsitePages,
  hashPageContent,
  processWebsitePagesWithLlm,
  scrapeWebsitePageRaw,
  type WebsitePageSection,
} from "@neylonai/integrations/website";
import {
  consumeWebsiteCrawlBudget,
  releaseWebsiteCrawlBudget,
  reserveWebsiteCrawlBudget,
} from "./budget";
import {
  DEFAULT_PAGE_CONCURRENCY,
  refreshPageDecision,
  usesWebsiteRefreshBudget,
  websiteRefreshBudgetSettlement,
} from "./helpers";
import {
  deleteWebsiteDocumentsNotInPaths,
  ingestWebsitePage,
} from "../ingest";
import {
  createWebsiteSource,
  ensureOrganizationIntegrationRow,
  refreshSourceDocumentCount,
  updateKnowledgeSource,
} from "../service";
import { MAIN_AGENT_KEY } from "../../agents/org-agents.types";

const CANCEL_POLL_MS = 1_000;

const PAGE_CONCURRENCY = Math.max(
  1,
  Number(process.env.CRAWL_PAGE_CONCURRENCY ?? DEFAULT_PAGE_CONCURRENCY) ||
    DEFAULT_PAGE_CONCURRENCY,
);

function classifyScrapeError(error: unknown): {
  message: string;
  httpStatus: number | null;
  status: "failed" | "not_found";
} {
  const message = error instanceof Error ? error.message : "Scrape failed";
  const httpStatus = Number(message.match(/\((\d{3})\)/)?.[1] ?? 0) || null;
  if (httpStatus === 404 || httpStatus === 410) {
    return { message, httpStatus, status: "not_found" };
  }
  return { message, httpStatus, status: "failed" };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (index < items.length) {
        if (shouldStop?.()) return;
        const current = items[index++];
        if (current === undefined) return;
        await fn(current);
      }
    },
  );
  await Promise.all(workers);
}

async function loadJob(jobId: string) {
  const [job] = await db
    .select()
    .from(websiteCrawlJobs)
    .where(eq(websiteCrawlJobs.id, jobId))
    .limit(1);
  return job ?? null;
}

async function setJob(
  jobId: string,
  values: Partial<typeof websiteCrawlJobs.$inferInsert> & {
    status?: WebsiteCrawlJobStatus;
  },
) {
  await db
    .update(websiteCrawlJobs)
    .set({ ...values, updated_at: new Date() })
    .where(eq(websiteCrawlJobs.id, jobId));
}

/**
 * Status writes must never resurrect a job the user stopped mid-step, so
 * transitions are ignored once the row reached `cancelling`/`cancelled`.
 */
async function setJobUnlessCancelled(
  jobId: string,
  values: Partial<typeof websiteCrawlJobs.$inferInsert> & {
    status?: WebsiteCrawlJobStatus;
  },
) {
  await db
    .update(websiteCrawlJobs)
    .set({ ...values, updated_at: new Date() })
    .where(
      and(
        eq(websiteCrawlJobs.id, jobId),
        notInArray(websiteCrawlJobs.status, ["cancelling", "cancelled"]),
      ),
    );
}

async function isCancelled(jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  return job?.status === "cancelling" || job?.status === "cancelled";
}

/**
 * Polls the job row so a stop request aborts in-flight scrapes instead of
 * waiting for the current page (and its provider timeout) to finish.
 */
function watchCancellation(jobId: string) {
  const controller = new AbortController();
  const timer = setInterval(() => {
    void isCancelled(jobId).then((cancelled) => {
      if (cancelled) controller.abort();
    });
  }, CANCEL_POLL_MS);
  timer.unref?.();
  return {
    signal: controller.signal,
    cancelled: () => controller.signal.aborted,
    markCancelled: () => controller.abort(),
    stop: () => clearInterval(timer),
  };
}

async function recordScrapeCogs(input: {
  organizationId: string;
  jobId: string;
  url: string;
  provider: string;
  creditsUsed: number;
}): Promise<void> {
  if (input.creditsUsed <= 0) return;
  const toolId =
    input.provider === "firecrawl"
      ? "firecrawl.scrape"
      : input.provider === "jina"
        ? "jina.reader"
        : null;
  if (!toolId) return;
  const { recordToolUsageSafe } = await import("../../billing/usage");
  recordToolUsageSafe({
    organizationId: input.organizationId,
    requestId: `website-crawl:${input.jobId}:${Date.now()}`,
    toolId,
    operation: "page",
    quantity: input.creditsUsed,
    metadata: {
      url: input.url,
      provider: input.provider,
    },
  });
}

async function finishJob(
  job: typeof websiteCrawlJobs.$inferSelect,
  status: "completed" | "failed" | "cancelled",
  error?: string,
) {
  // Only refresh jobs reserve a monthly refresh unit (reserved_pages is 0 or 1).
  const leftover = Math.max(
    0,
    job.reserved_pages - job.consumed_pages - job.released_pages,
  );
  let released = job.released_pages;
  let consumed = job.consumed_pages;
  if (leftover > 0) {
    if (websiteRefreshBudgetSettlement(status) === "release") {
      await releaseWebsiteCrawlBudget({
        organizationId: job.organization_id,
        yearMonth: job.year_month,
        pages: leftover,
      });
      released += leftover;
    } else {
      await consumeWebsiteCrawlBudget({
        organizationId: job.organization_id,
        yearMonth: job.year_month,
        pages: leftover,
      });
      consumed += leftover;
    }
  }
  const values = {
    status,
    error: error ?? null,
    reserved_pages: job.reserved_pages,
    consumed_pages: consumed,
    released_pages: released,
    finished_at: new Date(),
  };
  // A stop that lands during the final write still wins.
  if (status === "completed") {
    await setJobUnlessCancelled(job.id, values);
    return;
  }
  await setJob(job.id, values);
}

async function cancelRemainingPages(
  jobId: string,
  job: typeof websiteCrawlJobs.$inferSelect,
) {
  await db
    .update(websiteCrawlPages)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(
      and(
        eq(websiteCrawlPages.job_id, jobId),
        eq(websiteCrawlPages.status, "selected"),
      ),
    );
  await finishJob(job, "cancelled");
}

/**
 * Durable crawl processor. Safe to retry: discovery is upserted, pages
 * resume from `selected`, and failed scrapes keep the previous document.
 */
export async function processWebsiteCrawlJob(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  if (!job) return;
  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return;
  }
  if (job.status === "cancelling") {
    await finishJob(job, "cancelled");
    return;
  }

  const cancellation = watchCancellation(jobId);
  const finishIfCancelled = async () => {
    if (!cancellation.cancelled()) return false;
    const latest = await loadJob(jobId);
    if (latest) await cancelRemainingPages(jobId, latest);
    return true;
  };

  try {
    await setJobUnlessCancelled(jobId, {
      status: "discovering",
      started_at: job.started_at ?? new Date(),
    });

    const source = await createWebsiteSource({
      organizationId: job.organization_id,
      url: job.seed_url,
      agentIds: [MAIN_AGENT_KEY],
    });
    await setJobUnlessCancelled(jobId, { knowledge_source_id: source.id });
    if (await finishIfCancelled()) return;

    const existingPages = await db
      .select({ id: websiteCrawlPages.id })
      .from(websiteCrawlPages)
      .where(eq(websiteCrawlPages.job_id, jobId))
      .limit(1);

    if (existingPages.length === 0) {
      const discovery = await discoverWebsitePages({
        url: job.seed_url,
        maxPages: job.max_pages,
        signal: cancellation.signal,
      });
      if ((await isCancelled(jobId)) || cancellation.cancelled()) {
        cancellation.markCancelled();
        await finishIfCancelled();
        return;
      }
      if (discovery.selected.length === 0) {
        throw new Error("No evergreen pages found on this website.");
      }

      const existingDocs = await db
        .select({
          path: knowledgeDocuments.canonical_path,
          rawContent: knowledgeDocuments.raw_content,
        })
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.organization_id, job.organization_id),
            eq(knowledgeDocuments.source_id, source.id),
          ),
        );
      const docsByPath = new Map(
        existingDocs
          .filter((row) => row.path)
          .map((row) => [row.path!, row] as const),
      );
      const discoveredPages = discovery.selected.map((page) => {
        const previous = docsByPath.get(page.path);
        const decision =
          job.mode === "refresh"
            ? refreshPageDecision({
                hasStoredPage: Boolean(previous),
                discoveredLastmod: page.lastmod,
              })
            : "scrape";
        const status =
          decision === "skip_lastmod"
            ? "skipped_lastmod"
            : decision === "skip_existing"
              ? "skipped_existing"
              : "selected";
        return { page, previous, status };
      });
      const scrapeCount = discoveredPages.filter(
        ({ status }) => status === "selected",
      ).length;
      // Initial imports and failed-page retries are free. Only an explicit
      // refresh reserves one monthly refresh, regardless of page count.
      if (
        usesWebsiteRefreshBudget(job.mode) &&
        !(await reserveWebsiteCrawlBudget({
          organizationId: job.organization_id,
          yearMonth: job.year_month,
          pages: 1,
          limit: job.budget_limit,
        }))
      ) {
        throw new Error(
          `Website refresh limit reached (${job.budget_limit} refresh${
            job.budget_limit === 1 ? "" : "es"
          } this month). Upgrade for a higher limit.`,
        );
      }

      await db.insert(websiteCrawlPages).values(
        discoveredPages.map(({ page, previous, status }) => ({
          job_id: jobId,
          organization_id: job.organization_id,
          url: page.url,
          canonical_path: page.path,
          lastmod: page.lastmod,
          category: page.category,
          status,
          content_hash:
            typeof previous?.rawContent === "string" &&
            previous.rawContent.length > 0
              ? hashPageContent(previous.rawContent)
              : null,
        })),
      );

      await setJobUnlessCancelled(jobId, {
        status: "crawling",
        source: discovery.source,
        found_count: discovery.found,
        eligible_count: discovery.eligible,
        selected_count: discovery.selected.length,
        skipped_count: discovery.selected.length - scrapeCount,
        reserved_pages: usesWebsiteRefreshBudget(job.mode) ? 1 : 0,
      });
    } else if (job.status !== "crawling") {
      await setJobUnlessCancelled(jobId, { status: "crawling" });
    }
    if (await finishIfCancelled()) return;

    const pending = await db
      .select()
      .from(websiteCrawlPages)
      .where(
        and(
          eq(websiteCrawlPages.job_id, jobId),
          eq(websiteCrawlPages.status, "selected"),
        ),
      );

    const currentJob = await loadJob(jobId);
    if (
      usesWebsiteRefreshBudget(job.mode) &&
      currentJob &&
      currentJob.reserved_pages === 0
    ) {
      const reserved = await reserveWebsiteCrawlBudget({
        organizationId: job.organization_id,
        yearMonth: job.year_month,
        pages: 1,
        limit: job.budget_limit,
      });
      if (!reserved) {
        throw new Error(
          `Website refresh limit reached (${job.budget_limit} refresh${
            job.budget_limit === 1 ? "" : "es"
          } this month). Upgrade for a higher limit.`,
        );
      }
      await setJobUnlessCancelled(jobId, { reserved_pages: 1 });
    }

    let provider: string | null = job.provider;

    type RawScraped = {
      page: (typeof pending)[number];
      scraped: Awaited<ReturnType<typeof scrapeWebsitePageRaw>>;
    };

    type ScrapedReady = {
      page: (typeof pending)[number];
      scraped: {
        finalUrl: string;
        title: string;
        text: string;
        provider: Awaited<
          ReturnType<typeof scrapeWebsitePageRaw>
        >["provider"];
        sections: WebsitePageSection[];
        sectioner: "gemini" | "heuristic";
      };
      contentHash: string;
    };

    const rawReady: RawScraped[] = [];

    await mapPool(
      pending,
      PAGE_CONCURRENCY,
      async (page) => {
        if (cancellation.cancelled()) return;
        try {
          const scraped = await scrapeWebsitePageRaw(page.url, {
            signal: cancellation.signal,
          });
          if (cancellation.cancelled()) return;
          provider = scraped.provider;
          await recordScrapeCogs({
            organizationId: job.organization_id,
            jobId,
            url: scraped.finalUrl,
            provider: scraped.provider,
            creditsUsed: scraped.creditsUsed,
          });
          rawReady.push({ page, scraped });
        } catch (error) {
          if (cancellation.cancelled()) return;
          const failure = classifyScrapeError(error);
          await db
            .update(websiteCrawlPages)
            .set({
              status: failure.status,
              error: failure.message,
              http_status: failure.httpStatus,
              retry_count: sql`${websiteCrawlPages.retry_count} + 1`,
              updated_at: new Date(),
            })
            .where(eq(websiteCrawlPages.id, page.id));
          await db
            .update(websiteCrawlJobs)
            .set({
              failed_count: sql`${websiteCrawlJobs.failed_count} + 1`,
              updated_at: new Date(),
            })
            .where(eq(websiteCrawlJobs.id, jobId));
        }
      },
      () => cancellation.cancelled(),
    );

    if (cancellation.cancelled()) {
      await finishIfCancelled();
      return;
    }

    const existingSectionsByPath = await listExistingPageSections({
      organizationId: job.organization_id,
      sourceId: source.id,
      canonicalPaths: rawReady.map((item) => item.page.canonical_path),
    });

    const processedByPath = await processWebsitePagesWithLlm(
      rawReady.map((item) => ({
        pageKey: item.page.canonical_path,
        url: item.scraped.finalUrl,
        title: item.scraped.title,
        text: item.scraped.text,
        existingSections:
          existingSectionsByPath[item.page.canonical_path] ?? [],
      })),
    );

    if (cancellation.cancelled()) {
      await finishIfCancelled();
      return;
    }

    const ready: ScrapedReady[] = rawReady.map((item) => {
      const processed = processedByPath.get(item.page.canonical_path);
      if (!processed) {
        throw new Error(
          `Website processing omitted ${item.page.canonical_path}.`,
        );
      }
      const text = processed.cleanedText;
      const contentHash = hashPageContent(text);
      return {
        page: item.page,
        scraped: {
          finalUrl: item.scraped.finalUrl,
          title: item.scraped.title,
          text,
          provider: item.scraped.provider,
          sections: processed.sections,
          sectioner: processed.usedFallback ? "heuristic" : "gemini",
        },
        contentHash,
      };
    });

    if (cancellation.cancelled()) {
      await finishIfCancelled();
      return;
    }

    for (const item of ready) {
      if (cancellation.cancelled()) break;
      try {
        const ingested = await ingestWebsitePage({
          organizationId: job.organization_id,
          sourceId: source.id,
          url: item.scraped.finalUrl,
          path: item.page.canonical_path,
          provider: item.scraped.provider,
          sectioner: item.scraped.sectioner,
          text: item.scraped.text,
          lastmod: item.page.lastmod,
          contentHash: item.contentHash,
          sections: item.scraped.sections,
        });
        await db
          .update(websiteCrawlPages)
          .set({
            status: ingested.skipped ? "skipped_hash" : "scraped",
            content_hash: item.contentHash,
            provider: item.scraped.provider,
            url: item.scraped.finalUrl,
            updated_at: new Date(),
          })
          .where(eq(websiteCrawlPages.id, item.page.id));
        await db
          .update(websiteCrawlJobs)
          .set({
            scraped_count: ingested.skipped
              ? sql`${websiteCrawlJobs.scraped_count}`
              : sql`${websiteCrawlJobs.scraped_count} + 1`,
            skipped_count: ingested.skipped
              ? sql`${websiteCrawlJobs.skipped_count} + 1`
              : sql`${websiteCrawlJobs.skipped_count}`,
            provider: item.scraped.provider,
            updated_at: new Date(),
          })
          .where(eq(websiteCrawlJobs.id, jobId));
      } catch (error) {
        if (cancellation.cancelled()) break;
        const failure = classifyScrapeError(error);
        await db
          .update(websiteCrawlPages)
          .set({
            status: failure.status,
            error: failure.message,
            http_status: failure.httpStatus,
            retry_count: sql`${websiteCrawlPages.retry_count} + 1`,
            updated_at: new Date(),
          })
          .where(eq(websiteCrawlPages.id, item.page.id));
        await db
          .update(websiteCrawlJobs)
          .set({
            failed_count: sql`${websiteCrawlJobs.failed_count} + 1`,
            updated_at: new Date(),
          })
          .where(eq(websiteCrawlJobs.id, jobId));
      }
    }

    const latest = await loadJob(jobId);
    if (!latest) return;
    if (
      cancellation.cancelled() ||
      latest.status === "cancelling" ||
      latest.status === "cancelled"
    ) {
      cancellation.markCancelled();
      await cancelRemainingPages(jobId, latest);
      return;
    }

    const selected = await db
      .select({ path: websiteCrawlPages.canonical_path })
      .from(websiteCrawlPages)
      .where(
        and(
          eq(websiteCrawlPages.job_id, jobId),
          inArray(websiteCrawlPages.status, [
            "selected",
            "skipped_lastmod",
            "skipped_existing",
            "skipped_hash",
            "scraped",
            "not_found",
            "failed",
          ]),
        ),
      );
    if (job.mode !== "retry_failed") {
      await deleteWebsiteDocumentsNotInPaths({
        organizationId: job.organization_id,
        sourceId: source.id,
        selectedPaths: selected.map((row) => row.path),
      });
    }
    const documentCount = await refreshSourceDocumentCount(
      job.organization_id,
      source.id,
    );
    await updateKnowledgeSource({
      organizationId: job.organization_id,
      sourceId: source.id,
      websiteUrl: job.seed_url,
      documentCount,
      lastSyncedAt: new Date(),
    });

    const finished = await loadJob(jobId);
    if (!finished) return;
    await finishJob(finished, "completed");

    await ensureOrganizationIntegrationRow({
      organizationId: job.organization_id,
      catalogIntegrationId: "website",
      enabled: true,
      config: {
        url: job.seed_url,
        maxPages: job.max_pages,
        knowledgeSourceId: source.id,
        lastSyncAt: new Date().toISOString(),
        accountLabel: job.seed_url,
        scrapeProvider: provider,
        lastCrawl: {
          jobId,
          status: "completed",
          mode: job.mode,
          found: finished.found_count,
          eligible: finished.eligible_count,
          selected: finished.selected_count,
          scraped: finished.scraped_count,
          skipped: finished.skipped_count,
          failed: finished.failed_count,
        },
      },
    });
  } catch (error) {
    const latest = await loadJob(jobId);
    if (!latest) return;
    if (cancellation.cancelled() || latest.status === "cancelling") {
      await cancelRemainingPages(jobId, latest);
      return;
    }
    const message = error instanceof Error ? error.message : "Crawl failed";
    await finishJob(latest, "failed", message);
    await ensureOrganizationIntegrationRow({
      organizationId: latest.organization_id,
      catalogIntegrationId: "website",
      enabled: true,
      config: {
        lastCrawl: {
          jobId,
          status: "failed",
          error: message,
        },
      },
    });
    throw error;
  } finally {
    cancellation.stop();
  }
}
