import { tool } from "@langchain/core/tools";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChromaClient } from "chromadb";
import { z } from "zod";

const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME ?? "organization_data";

let chromaClient: ChromaClient | null = null;
let embeddingModel: OpenAIEmbeddings | null = null;
let queryExpansionChain: ReturnType<typeof buildQueryExpansionChain> | null = null;

function getChromaClient(): ChromaClient | null {
  if (!process.env.CHROMA_API_KEY) return null;
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: "https://api.trychroma.com:8000",
      auth: {
        provider: "token",
        credentials: process.env.CHROMA_API_KEY,
        tokenHeaderType: "X_CHROMA_TOKEN",
      },
      tenant: process.env.CHROMA_TENANT ?? "default_tenant",
      database: process.env.CHROMA_DATABASE ?? "default_database",
    });
  }
  return chromaClient;
}

function getEmbeddingModel(): OpenAIEmbeddings {
  if (!embeddingModel) {
    embeddingModel = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return embeddingModel;
}

function buildQueryExpansionChain() {
  const prompt = PromptTemplate.fromTemplate(
    `You are an AI language model assistant. Your task is to generate 3 
different versions of the given user question to retrieve relevant documents from a vector 
database. By generating multiple perspectives on the user question, your goal is to help
the user overcome some of the limitations of the distance-based similarity search. 
Provide these alternative questions separated by newlines. Original question: {question}`,
  );

  const llm = new ChatOpenAI({
    model: "gpt-4.1-nano",
    temperature: 0.4,
    apiKey: process.env.OPENAI_API_KEY,
  });

  return prompt
    .pipe(llm)
    .pipe(new StringOutputParser())
    .pipe((output: string) =>
      output
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean)
        .slice(0, 3),
    );
}

function getQueryExpansionChain() {
  if (!queryExpansionChain) {
    queryExpansionChain = buildQueryExpansionChain();
  }
  return queryExpansionChain;
}

async function searchSingleQuery(
  query: string,
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
): Promise<string[]> {
  const embedding = await getEmbeddingModel().embedQuery(query);
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: 5,
  });

  const docs = results.documents?.[0] ?? [];
  return docs.filter((d): d is string => !!d);
}

async function runSemanticSearch(query: string): Promise<string> {
  const client = getChromaClient();
  if (!client) {
    return "Semantic search is unavailable (ChromaDB not configured).";
  }

  try {
    const collection = await client.getCollection({ name: COLLECTION_NAME });

    const expandedQueries = await getQueryExpansionChain().invoke({ question: query });
    const allQueries = [query, ...expandedQueries].slice(0, 3);

    const resultSets = await Promise.all(
      allQueries.map((q) => searchSingleQuery(q, collection).catch(() => [] as string[])),
    );

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const docs of resultSets) {
      for (const doc of docs) {
        if (!seen.has(doc)) {
          seen.add(doc);
          unique.push(doc);
        }
      }
    }

    if (unique.length === 0) return "No relevant documents found.";
    return unique.join("\n\n---\n\n");
  } catch (error) {
    console.error("semantic_search error:", error);
    return "No relevant documents found.";
  }
}

export const semanticSearchTool = tool(
  async ({ query }: { query: string }) => {
    console.log("semantic_search called with:", query);
    return await runSemanticSearch(query);
  },
  {
    name: "semantic_search",
    description:
      "Search the website knowledge base for information about Neylon-AI services, pricing, features, integrations, and FAQs. Use this for any question about the company or its offerings.",
    schema: z.object({
      query: z.string().describe("The natural language search query"),
    }),
  },
);
