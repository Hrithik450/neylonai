import type { IntegrationModule } from "../catalog/module";
import {
  extractMarkdownLinks,
  extractSameOriginLinks,
  looksLikeDynamicCatalogUrl,
  scrapePublicUrl,
  type ScrapeProvider,
} from "../internal/scrape";
import { llmSelectEvergreenUrls, llmStripDatabaseBackedContent } from "./llm";
import { websiteManifest } from "./manifest";

export { websiteManifest } from "./manifest";

export type WebsiteFetchResult = {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  fetchedAt: string;
  pagesScraped: number;
  provider: ScrapeProvider;
  creditsUsed: number;
};

const MAX_CANDIDATE_LINKS = 40;
const MAX_PAGES = 8;
const MAX_TOTAL_CHARS = 220_000;

/**
 * Website import:
 * 1) Scrape full page markdown (Firecrawl → Jina → static)
 * 2) Follow same-origin links for more full pages
 * 3) Only then ask the LLM to strip DB-backed catalog noise (never summarize)
 */
export async function fetchWebsiteForImport(
  urlInput: string,
): Promise<WebsiteFetchResult> {
  const seed = await scrapePublicUrl(urlInput);

  const linkPool = [
    ...(seed.html ? extractSameOriginLinks(seed.html, seed.finalUrl) : []),
    ...(seed.links ?? []).filter((u) => {
      try {
        return new URL(u).hostname === new URL(seed.finalUrl).hostname;
      } catch {
        return false;
      }
    }),
    ...extractMarkdownLinks(seed.text, seed.finalUrl),
  ].filter((u) => !looksLikeDynamicCatalogUrl(u));

  const candidates = [
    seed.finalUrl.replace(/\/$/, ""),
    ...linkPool,
  ].slice(0, MAX_CANDIDATE_LINKS);

  const uniqueCandidates = [...new Set(candidates)];
  const selected = await llmSelectEvergreenUrls(
    seed.finalUrl,
    uniqueCandidates,
    MAX_PAGES,
  );

  const pages: Array<{
    url: string;
    title: string;
    text: string;
    provider: ScrapeProvider;
  }> = [];
  const seen = new Set<string>();
  let creditsUsed = 0;
  let primaryProvider: ScrapeProvider = seed.provider;

  async function addRawPage(scraped: {
    finalUrl: string;
    title: string;
    text: string;
    provider: ScrapeProvider;
    creditsUsed?: number;
  }) {
    const body = scraped.text.trim();
    if (!body) return;
    creditsUsed += scraped.creditsUsed ?? 0;
    primaryProvider = scraped.provider;
    pages.push({
      url: scraped.finalUrl,
      title: scraped.title,
      text: body.slice(0, 80_000),
      provider: scraped.provider,
    });
  }

  await addRawPage(seed);
  seen.add(seed.finalUrl.replace(/\/$/, ""));

  for (const pageUrl of selected) {
    if (pages.length >= MAX_PAGES) break;
    const key = pageUrl.replace(/\/$/, "");
    if (seen.has(key)) continue;
    if (looksLikeDynamicCatalogUrl(pageUrl)) continue;
    seen.add(key);

    try {
      const scraped = await scrapePublicUrl(pageUrl);
      await addRawPage(scraped);
    } catch {
      // skip failed pages
    }
  }

  if (pages.length === 0) {
    throw new Error("No readable text found on this website.");
  }

  // Full scrape first — then one LLM pass to strip catalog noise only.
  const combinedRaw = pages
    .map((p) => `# ${p.title}\nSource: ${p.url}\n\n${p.text}`)
    .join("\n\n---\n\n");

  let cleaned = await llmStripDatabaseBackedContent({
    url: seed.finalUrl,
    title: seed.title,
    text: combinedRaw,
  });
  if (!cleaned.trim() || cleaned.trim().length < combinedRaw.length * 0.25) {
    cleaned = combinedRaw;
  }
  if (cleaned.length > MAX_TOTAL_CHARS) {
    cleaned = cleaned.slice(0, MAX_TOTAL_CHARS);
  }

  return {
    url: seed.url,
    finalUrl: seed.finalUrl,
    title: seed.title,
    text: cleaned,
    fetchedAt: new Date().toISOString(),
    pagesScraped: pages.length,
    provider: primaryProvider,
    creditsUsed,
  };
}

export const websiteIntegration = {
  manifest: websiteManifest,
  fetchForImport: fetchWebsiteForImport,
} as const satisfies IntegrationModule & {
  fetchForImport: typeof fetchWebsiteForImport;
};
