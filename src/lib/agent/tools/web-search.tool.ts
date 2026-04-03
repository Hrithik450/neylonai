import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return "Web search is unavailable (TAVILY_API_KEY not configured).";
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
}

export const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    console.log("web_search called with:", query);
    try {
      return await tavilySearch(query);
    } catch (error) {
      console.error("web_search error:", error);
      return "Web search failed. Please try again.";
    }
  },
  {
    name: "web_search",
    description:
      "Search the internet for real-time information. Use as a last resort when the knowledge base does not have the answer — best for current events, general knowledge, or external topics not related to Neylon-AI.",
    schema: z.object({
      query: z.string().describe("The search query to look up on the web"),
    }),
  },
);
