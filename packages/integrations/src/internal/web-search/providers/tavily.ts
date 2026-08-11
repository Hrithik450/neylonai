import { webSearchProviders } from "../registry";
import type { WebSearchProvider } from "../types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export type TavilySearchDepth = "basic" | "advanced";

/** Real-time web search backed by the Tavily API. */
export const tavilyWebSearchProvider: WebSearchProvider = {
  name: "tavily",
  async search(query: string): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "Web search is temporarily unavailable.";
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: 3,
        search_depth: "basic",
        include_answer: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = (await response.json()) as TavilyResponse;

    if (!data.results?.length) return "No results found.";

    return data.results
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
      .join("\n\n---\n\n");
  },
};

webSearchProviders.register(tavilyWebSearchProvider.name, tavilyWebSearchProvider);
