import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { knowledgeSearchProviders } from "../knowledge-search";

export const semanticSearchTool = tool(
  async ({ query }: { query: string }) => {
    console.log("semantic_search called with:", query);
    const provider = knowledgeSearchProviders.getDefault();
    if (!provider) {
      return "Semantic search is unavailable (no knowledge search provider registered).";
    }

    try {
      const docs = await provider.search(query);
      if (docs.length === 0) return "No relevant documents found.";
      // Content only to the LLM — never private URLs, paths, or source ids.
      return docs
        .map((d) => d.content)
        .filter(Boolean)
        .join("\n\n---\n\n");
    } catch (error) {
      console.error("semantic_search error:", error);
      return "No relevant documents found.";
    }
  },
  {
    name: "semantic_search",
    description:
      "Search the organization knowledge base for product, pricing, feature, and FAQ information. Use this for questions about the company or its offerings.",
    schema: z.object({
      query: z.string().describe("The natural language search query"),
    }),
  },
);
