import { createHash } from "node:crypto";
import type { IntegrationModule } from "../catalog/module";
import { scrapePublicUrl, type ScrapeProvider } from "../internal/scrape";
import { discoverWebsitePages } from "./discover";
import { processWebsitePages } from "./process-pages";
import { websiteManifest } from "./manifest";

export { websiteManifest } from "./manifest";
export type { ScrapeProvider } from "../internal/scrape";
export { discoverWebsitePages } from "./discover";
export type { WebsiteDiscoveryResult, DiscoveredPage } from "./discover";
export {
  classifyUrl,
  rankEvergreen,
  categorySummary,
  type ClassifiedUrl,
  type EvergreenCategory,
} from "./evergreen";
export { parseRobotsTxt, isDisallowedByRobots } from "./robots";
export { parseSitemapXml } from "./sitemap";
export {
  cleanHeading,
  deterministicCleanPageText,
  sectionIdFromHeading,
} from "./page-text";
export {
  extractDomPageSections,
  htmlToPlainText,
  labelFromSectionId,
  SECTION_TRACK_TAGS,
  type DomPageSection,
} from "./dom-sections";
export {
  processWebsitePages,
  type ProcessedWebsitePage,
  type WebsiteProcessingInput,
} from "./process-pages";
export { llmRerankEvergreenUrls } from "./llm";
export {
  normalizePageUrl,
  canonicalPathOf,
  sameSiteHost,
  MAX_DISCOVERED_URLS,
} from "./urls";
export {
  normalizeWebsiteInputUrl,
  verifyWebsiteUrl,
  WebsiteUrlError,
  type VerifiedWebsiteUrl,
  type WebsiteUrlErrorCode,
} from "./verify";

export type WebsiteFetchResult = {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  fetchedAt: string;
  pagesScraped: number;
  provider: ScrapeProvider;
  creditsUsed: number;
  pages: Array<{
    url: string;
    title: string;
    text: string;
    lastmod: string | null;
    path: string;
  }>;
};

const MAX_TOTAL_CHARS = 220_000;
const MAX_PAGE_CHARS = 80_000;

export function hashPageContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Scrape only — no LLM cleaning. Used when the crawl job batches cleaning. */
export async function scrapeWebsitePageRaw(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<{
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  html?: string;
  provider: ScrapeProvider;
  creditsUsed: number;
}> {
  const scraped = await scrapePublicUrl(url, options);
  const raw = scraped.text.trim();
  if (!raw) {
    throw new Error("No readable text found on this page.");
  }
  return {
    url,
    finalUrl: scraped.finalUrl,
    title: scraped.title,
    text: raw.slice(0, MAX_PAGE_CHARS),
    html: scraped.html?.slice(0, MAX_PAGE_CHARS),
    provider: scraped.provider,
    creditsUsed: scraped.creditsUsed ?? 0,
  };
}

export async function scrapeWebsitePage(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<{
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  provider: ScrapeProvider;
  creditsUsed: number;
}> {
  const scraped = await scrapeWebsitePageRaw(url, options);
  const processed = await processWebsitePages([
    {
      pageKey: "_",
      url: scraped.finalUrl,
      title: scraped.title,
      text: scraped.text,
    },
  ]);
  const page = processed.get("_");
  if (!page) throw new Error("Website processing returned no page.");
  const text = page.cleanedText.slice(0, MAX_PAGE_CHARS);
  return {
    ...scraped,
    text,
  };
}

/**
 * Discover evergreen URLs (sitemap-first), then scrape only the selected set.
 */
export async function fetchWebsiteForImport(
  urlInput: string,
  options?: { maxPages?: number },
): Promise<WebsiteFetchResult> {
  const maxPages = options?.maxPages ?? 8;
  const discovery = await discoverWebsitePages({
    url: urlInput,
    maxPages,
  });

  const pages: Array<{
    url: string;
    title: string;
    text: string;
    lastmod: string | null;
    path: string;
    provider: ScrapeProvider;
  }> = [];
  let creditsUsed = 0;
  let primaryProvider: ScrapeProvider = "static";

  for (const selected of discovery.selected) {
    try {
      const scraped = await scrapePublicUrl(selected.url);
      const body = scraped.text.trim();
      if (!body) continue;
      creditsUsed += scraped.creditsUsed ?? 0;
      primaryProvider = scraped.provider;
      pages.push({
        url: scraped.finalUrl,
        title: scraped.title,
        text: body.slice(0, 80_000),
        lastmod: selected.lastmod,
        path: selected.path,
        provider: scraped.provider,
      });
    } catch {
      // skip failed pages
    }
  }

  if (pages.length === 0) {
    throw new Error("No readable text found on this website.");
  }

  const processedByPath = await processWebsitePages(
    pages.map((page) => ({
      pageKey: page.path,
      url: page.url,
      title: page.title,
      text: page.text,
    })),
  );

  const cleanedPages = pages.map((page) => {
    const processed = processedByPath.get(page.path);
    if (!processed) {
      throw new Error(`Website processing omitted ${page.path}.`);
    }
    return { ...page, text: processed.cleanedText.slice(0, 80_000) };
  });

  let combined = cleanedPages
    .map((p) => `# ${p.title}\nSource: ${p.url}\n\n${p.text}`)
    .join("\n\n---\n\n");
  if (combined.length > MAX_TOTAL_CHARS) {
    combined = combined.slice(0, MAX_TOTAL_CHARS);
  }

  return {
    url: urlInput,
    finalUrl: discovery.seedUrl,
    title: cleanedPages[0]!.title,
    text: combined,
    fetchedAt: new Date().toISOString(),
    pagesScraped: cleanedPages.length,
    provider: primaryProvider,
    creditsUsed,
    pages: cleanedPages.map(({ url, title, text, lastmod, path }) => ({
      url,
      title,
      text,
      lastmod,
      path,
    })),
  };
}

export const websiteIntegration = {
  manifest: websiteManifest,
  fetchForImport: fetchWebsiteForImport,
} as const satisfies IntegrationModule & {
  fetchForImport: typeof fetchWebsiteForImport;
};
