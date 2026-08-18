/**
 * Firecrawl scrape — managed JS rendering + clean markdown.
 * Docs: https://docs.firecrawl.dev/api-reference/endpoint/scrape
 *
 * Free plan: 1,000 credits/mo (1 credit per page scrape).
 * Requires FIRECRAWL_API_KEY.
 */

import type { ScrapeResult } from "../types";

const FIRECRAWL_TIMEOUT_MS = 60_000;
const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

export function getFirecrawlApiKey(): string | null {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  return key || null;
}

export async function scrapeWithFirecrawl(
  urlInput: string,
  options?: { signal?: AbortSignal },
): Promise<ScrapeResult> {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured.");
  }

  const target = urlInput.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  const stop = () => controller.abort();
  options?.signal?.addEventListener("abort", stop, { once: true });

  try {
    const res = await fetch(FIRECRAWL_API, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: target,
        formats: ["markdown", "html", "links"],
        onlyMainContent: false,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      data?: {
        markdown?: string;
        html?: string;
        metadata?: {
          title?: string;
          sourceURL?: string;
          url?: string;
        };
        links?: string[];
      };
    };

    if (!res.ok || json.success === false) {
      throw new Error(json.error || `Firecrawl scrape failed (${res.status}).`);
    }

    const markdown = (json.data?.markdown ?? "").trim();
    if (!markdown) {
      throw new Error("Firecrawl returned empty markdown.");
    }

    const title =
      (json.data?.metadata?.title ?? "Untitled page").trim().slice(0, 300) ||
      "Untitled page";
    const finalUrl =
      json.data?.metadata?.sourceURL || json.data?.metadata?.url || target;

    const html = (json.data?.html ?? "").trim();

    return {
      url: target,
      finalUrl,
      title,
      text: markdown.slice(0, 200_000),
      html: html ? html.slice(0, 200_000) : undefined,
      fetchedAt: new Date().toISOString(),
      provider: "firecrawl",
      creditsUsed: 1,
      links: Array.isArray(json.data?.links) ? json.data.links : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (options?.signal?.aborted) throw new Error("Scrape stopped.");
      throw new Error("Timed out fetching via Firecrawl.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", stop);
  }
}
