import {
  extractMarkdownLinks,
  extractSameOriginLinks,
  scrapePublicUrl,
} from "../internal/scrape";
import {
  categorySummary,
  classifyUrl,
  rankEvergreen,
  type ClassifiedUrl,
} from "./evergreen";
import { fetchPublicText } from "./fetch-document";
import { llmRerankEvergreenUrls } from "./llm";
import { isDisallowedByRobots, parseRobotsTxt } from "./robots";
import { parseSitemapXml, STANDARD_SITEMAP_PATHS } from "./sitemap";
import {
  MAX_DISCOVERED_URLS,
  assertSafePublicHttpUrl,
  canonicalPathOf,
  normalizePageUrl,
  originOf,
  sameSiteHost,
} from "./urls";

const MAX_SITEMAP_FILES = 50;
const MAX_LINK_FALLBACK = 40;

export type DiscoveredPage = ClassifiedUrl;

export type WebsiteDiscoveryResult = {
  seedUrl: string;
  origin: string;
  source: "sitemap" | "links";
  found: number;
  eligible: number;
  selected: DiscoveredPage[];
  categories: Record<string, number>;
  truncated: boolean;
};

export async function discoverWebsitePages(input: {
  url: string;
  maxPages: number;
  useLlm?: boolean;
  signal?: AbortSignal;
}): Promise<WebsiteDiscoveryResult> {
  const seed = assertSafePublicHttpUrl(input.url);
  const origin = originOf(seed);
  const maxPages = Math.max(1, input.maxPages);
  const throwIfStopped = () => {
    if (input.signal?.aborted) throw new Error("Discovery stopped.");
  };

  const robots = await loadRobots(origin);
  throwIfStopped();
  const sitemapUrls = [
    ...robots.sitemapUrls,
    ...STANDARD_SITEMAP_PATHS.map((path) => `${origin}${path}`),
  ];

  const fromSitemaps = await collectSitemapUrls({
    seed,
    sitemapUrls,
    disallowPrefixes: robots.disallowPrefixes,
  });
  throwIfStopped();

  let source: "sitemap" | "links" = "sitemap";
  let classified = fromSitemaps.classified;
  let truncated = fromSitemaps.truncated;

  if (classified.filter((c) => !c.excluded).length === 0) {
    source = "links";
    classified = await collectLinkFallback(
      seed.toString(),
      robots.disallowPrefixes,
    );
    throwIfStopped();
  }

  const eligible = classified.filter((c) => !c.excluded);
  const heuristic = rankEvergreen(eligible, Math.max(maxPages * 4, maxPages));
  const selected =
    input.useLlm === false
      ? heuristic.slice(0, maxPages)
      : await llmRerankEvergreenUrls(seed.toString(), heuristic, maxPages);

  const unique = dedupeSelected(selected, maxPages);
  return {
    seedUrl: seed.toString(),
    origin,
    source,
    found: classified.length,
    eligible: eligible.length,
    selected: unique,
    categories: categorySummary(unique),
    truncated,
  };
}

function dedupeSelected(
  items: ClassifiedUrl[],
  maxPages: number,
): ClassifiedUrl[] {
  const seen = new Set<string>();
  const out: ClassifiedUrl[] = [];
  for (const item of items) {
    const key = item.path;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxPages) break;
  }
  return out;
}

async function loadRobots(origin: string) {
  try {
    const doc = await fetchPublicText(
      `${origin}/robots.txt`,
      "text/plain, */*;q=0.1",
    );
    return parseRobotsTxt(doc.text, origin);
  } catch {
    return { sitemapUrls: [] as string[], disallowPrefixes: [] as string[] };
  }
}

async function collectSitemapUrls(input: {
  seed: URL;
  sitemapUrls: string[];
  disallowPrefixes: string[];
}): Promise<{ classified: ClassifiedUrl[]; truncated: boolean }> {
  const queue = [...new Set(input.sitemapUrls)];
  const seenSitemaps = new Set<string>();
  const classified: ClassifiedUrl[] = [];
  const seenPaths = new Set<string>();
  let truncated = false;
  let files = 0;

  while (queue.length > 0) {
    if (
      files >= MAX_SITEMAP_FILES ||
      classified.length >= MAX_DISCOVERED_URLS
    ) {
      truncated = true;
      break;
    }
    const next = queue.shift()!;
    if (seenSitemaps.has(next)) continue;
    seenSitemaps.add(next);
    files += 1;

    let xml: string;
    try {
      const doc = await fetchPublicText(
        next,
        "application/xml, text/xml, application/gzip, */*;q=0.2",
      );
      if (!sameSiteHost(new URL(doc.finalUrl).hostname, input.seed.hostname)) {
        continue;
      }
      xml = doc.text;
    } catch {
      continue;
    }

    const parsed = parseSitemapXml(xml, next);
    for (const child of parsed.childSitemaps) {
      try {
        const childUrl = new URL(child);
        if (!sameSiteHost(childUrl.hostname, input.seed.hostname)) continue;
        queue.push(childUrl.toString());
      } catch {
        // ignore
      }
    }

    for (const entry of parsed.urls) {
      if (classified.length >= MAX_DISCOVERED_URLS) {
        truncated = true;
        break;
      }
      const normalized = normalizePageUrl(entry.loc, input.seed.toString());
      if (!normalized) continue;
      if (!sameSiteHost(normalized.hostname, input.seed.hostname)) continue;
      const path = canonicalPathOf(normalized);
      if (isDisallowedByRobots(path, input.disallowPrefixes)) continue;
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      classified.push(
        classifyUrl({
          url: normalized.toString(),
          path,
          lastmod: entry.lastmod,
          sitemapGroup: entry.sitemapGroup,
        }),
      );
    }
  }

  return { classified, truncated };
}

async function collectLinkFallback(
  seedUrl: string,
  disallowPrefixes: string[],
): Promise<ClassifiedUrl[]> {
  const seed = await scrapePublicUrl(seedUrl);
  const pool = [
    seed.finalUrl.replace(/\/+$/, ""),
    ...(seed.html ? extractSameOriginLinks(seed.html, seed.finalUrl) : []),
    ...(seed.links ?? []),
    ...extractMarkdownLinks(seed.text, seed.finalUrl),
  ].slice(0, MAX_LINK_FALLBACK);

  const classified: ClassifiedUrl[] = [];
  const seen = new Set<string>();
  const seedHost = new URL(seed.finalUrl).hostname;
  for (const raw of pool) {
    const normalized = normalizePageUrl(raw, seed.finalUrl);
    if (!normalized) continue;
    if (!sameSiteHost(normalized.hostname, seedHost)) continue;
    const path = canonicalPathOf(normalized);
    if (isDisallowedByRobots(path, disallowPrefixes)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    classified.push(
      classifyUrl({
        url: normalized.toString(),
        path,
        lastmod: null,
        sitemapGroup: "link-fallback",
      }),
    );
  }
  return classified;
}
