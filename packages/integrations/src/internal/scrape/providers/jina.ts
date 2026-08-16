/**
 * Jina Reader — free URL→markdown (handles JS-rendered pages).
 * Docs: https://r.jina.ai/  · https://jina.ai/reader
 *
 * Free: rate-limited, no key required.
 * Optional JINA_API_KEY raises rate limits (token billing on paid).
 */

import type { ScrapeResult } from "../types";

const JINA_TIMEOUT_MS = 45_000;

export async function scrapeWithJina(
  urlInput: string,
  options?: { signal?: AbortSignal },
): Promise<ScrapeResult> {
  const target = urlInput.trim();
  const endpoint = `https://r.jina.ai/${target}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);
  const stop = () => controller.abort();
  options?.signal?.addEventListener("abort", stop, { once: true });
  const apiKey = process.env.JINA_API_KEY?.trim();

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/plain",
        "User-Agent": "NeylonAI-Scraper/1.0 (+https://neylon.ai)",
        "X-Return-Format": "markdown",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Jina Reader failed (${res.status}).`);
    }
    const raw = (await res.text()).trim();
    if (!raw || raw.length < 40) {
      throw new Error("Jina Reader returned empty content.");
    }

    const titleMatch = raw.match(/^Title:\s*(.+)$/m);
    const urlMatch = raw.match(/^URL Source:\s*(.+)$/m);
    const mdMatch = raw.match(/Markdown Content:\s*([\s\S]*)$/i);
    const text = (mdMatch?.[1] ?? raw).trim();
    const title = (titleMatch?.[1] ?? "Untitled page").trim().slice(0, 300);
    const finalUrl = (urlMatch?.[1] ?? target).trim();

    if (!text) throw new Error("Jina Reader returned empty content.");

    return {
      url: target,
      finalUrl,
      title,
      text: text.slice(0, 200_000),
      fetchedAt: new Date().toISOString(),
      provider: "jina",
      creditsUsed: 1,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (options?.signal?.aborted) throw new Error("Scrape stopped.");
      throw new Error("Timed out fetching via Jina Reader.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", stop);
  }
}
