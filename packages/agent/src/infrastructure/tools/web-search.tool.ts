import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { webSearchProviders } from "@neylonai/integrations";
import { meterToolUsage } from "../metering";

export const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    console.log("web_search called with:", query);
    const provider = webSearchProviders.getDefault();
    if (!provider) {
      return "Web search is unavailable (no web-search provider registered).";
    }

    try {
      const result = await provider.search(query);
      // Default Tavily provider uses search_depth: "basic" (1 credit).
      if (provider.name === "tavily") {
        meterToolUsage("tavily.search", "basic", {
          metadata: { queryLength: query.length },
        });
      } else {
        meterToolUsage(`web_search.${provider.name}`, "search", {
          metadata: { queryLength: query.length },
        });
      }
      return result;
    } catch (error) {
      console.error("web_search error:", error);
      return "Web search failed. Please try again.";
    }
  },
  {
    name: "web_search",
    description:
      "Search the open web for real-time information. Only available when the Web Search integration is enabled. Use as a last resort when the knowledge base does not have the answer.",
    schema: z.object({
      query: z.string().describe("The search query to look up on the web"),
    }),
  },
);
