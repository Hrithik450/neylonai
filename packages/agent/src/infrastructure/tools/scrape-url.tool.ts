import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { scrapePublicUrl } from "@neylonai/integrations/scrape";

/**
 * Reusable scrape tool for agents. Independent of the Website integration
 * (which syncs into org knowledge). Use when a one-off public page fetch is needed.
 */
export const scrapeUrlTool = tool(
  async ({ url }: { url: string }) => {
    try {
      const result = await scrapePublicUrl(url);
      const body = result.text.slice(0, 24_000);
      return JSON.stringify({
        title: result.title,
        url: result.finalUrl,
        fetchedAt: result.fetchedAt,
        provider: result.provider,
        text: body,
        truncated: result.text.length > 24_000,
      });
    } catch (error) {
      return `Scrape failed: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  },
  {
    name: "scrape_url",
    description:
      "Fetch a public HTTP(S) page (JS-rendered via Jina/Firecrawl when available) and return readable markdown/text. Use for a one-off page the visitor referenced that is not already in the knowledge base. Does not store content — organization Website sync is separate.",
    schema: z.object({
      url: z.string().url().describe("Public http(s) URL to scrape"),
    }),
  },
);
