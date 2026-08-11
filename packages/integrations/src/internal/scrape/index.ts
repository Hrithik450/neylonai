/**
 * Shared public-page scrape: Firecrawl → Jina Reader → static HTML.
 * Prefer managed JS renderers so CSR sites (Next.js bailout) still yield content.
 */

export type { ScrapeProvider, ScrapeResult } from "./types";

import type { ScrapeResult } from "./types";
import {
  getFirecrawlApiKey,
  scrapeWithFirecrawl,
} from "./providers/firecrawl";
import { scrapeWithJina } from "./providers/jina";

const MAX_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 200_000;
const FETCH_TIMEOUT_MS = 20_000;

export function stripHtml(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  const metaDesc =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    )?.[1] ??
    "";

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  body = body.replace(/<[^>]+>/g, " ");
  body = body
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  const pieces = [metaDesc.trim(), body].filter(Boolean);
  return {
    title: title || "Untitled page",
    text: pieces.join("\n\n").slice(0, MAX_TEXT_CHARS),
  };
}

export function assertPublicHttpUrl(raw: string): URL {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw new Error("Enter a public hostname (not localhost).");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    throw new Error("Localhost URLs cannot be scraped.");
  }
  return parsed;
}

/** Paths that are usually product/catalog/dynamic DB-backed pages. */
const EXCLUDE_PATH_RE =
  /\/(products?|items?|sku|cart|checkout|search|collections?|catalog|category|categories|shop\/|dp\/|p\/\d|listing|inventory|variants?)(\/|$)/i;

export function looksLikeDynamicCatalogUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (EXCLUDE_PATH_RE.test(u.pathname)) return true;
    if (/\/[0-9]{5,}(\/|$)/.test(u.pathname)) return true;
    if (/[?&](sku|product_id|item_id|variant)=/i.test(u.search)) return true;
    return false;
  } catch {
    return true;
  }
}

export function extractSameOriginLinks(
  html: string,
  baseUrl: string,
): string[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const hrefs = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map(
    (m) => m[1]!,
  );
  const out = new Set<string>();
  for (const href of hrefs) {
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }
    try {
      const abs = new URL(href, base);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (abs.hostname !== base.hostname) continue;
      abs.hash = "";
      const normalized = abs.toString().replace(/\/$/, "") || abs.origin;
      if (looksLikeDynamicCatalogUrl(normalized)) continue;
      out.add(normalized);
    } catch {
      // ignore bad hrefs
    }
  }
  return [...out];
}

/** Markdown link extractor for Jina/Firecrawl markdown bodies. */
export function extractMarkdownLinks(markdown: string, baseUrl: string): string[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const out = new Set<string>();
  for (const m of markdown.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi)) {
    try {
      const abs = new URL(m[1]!, base);
      if (abs.hostname !== base.hostname) continue;
      abs.hash = "";
      const normalized = abs.toString().replace(/\/$/, "") || abs.origin;
      if (looksLikeDynamicCatalogUrl(normalized)) continue;
      out.add(normalized);
    } catch {
      // ignore
    }
  }
  return [...out];
}

export async function fetchPublicHtml(urlInput: string): Promise<{
  url: string;
  finalUrl: string;
  html: string;
  fetchedAt: string;
}> {
  const parsed = assertPublicHttpUrl(urlInput);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "NeylonAI-Scraper/1.0 (+https://neylon.ai)",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL (${res.status}).`);
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error("URL did not return HTML content.");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Page is too large to scrape.");
    }

    return {
      url: parsed.toString(),
      finalUrl: res.url || parsed.toString(),
      html: buf.toString("utf8"),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out fetching the URL.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeStatic(urlInput: string): Promise<ScrapeResult> {
  const page = await fetchPublicHtml(urlInput);
  const { title, text } = stripHtml(page.html);
  if (!text.trim()) {
    throw new Error("No readable text found on this page.");
  }
  return {
    url: page.url,
    finalUrl: page.finalUrl,
    title,
    text,
    html: page.html,
    fetchedAt: page.fetchedAt,
    provider: "static",
    creditsUsed: 0,
  };
}

/**
 * Fetch a public page as readable text/markdown.
 * Order: Firecrawl (if key) → Jina Reader (free) → static HTML.
 */
export async function scrapePublicUrl(urlInput: string): Promise<ScrapeResult> {
  assertPublicHttpUrl(urlInput);
  const errors: string[] = [];

  if (getFirecrawlApiKey()) {
    try {
      return await scrapeWithFirecrawl(urlInput);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Firecrawl failed");
    }
  }

  try {
    return await scrapeWithJina(urlInput);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Jina failed");
  }

  try {
    return await scrapeStatic(urlInput);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Static scrape failed");
    throw new Error(
      `Could not scrape URL. ${errors.filter(Boolean).join(" · ")}`,
    );
  }
}
