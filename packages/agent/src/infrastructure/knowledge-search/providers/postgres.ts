import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  resolveKnowledgeScope,
  searchKnowledgeByVector,
} from "@neylonai/database";
import { listAllowedSourceIds } from "@neylonai/domain/knowledge";
import { withGoogleApiRetry } from "@neylonai/integrations";
import { getProviderModel } from "../../../providers";
import { prompts } from "../../../lib/prompts";
import {
  getEmbeddingModel,
  getUtilityModel,
  MODEL_DEFAULTS,
} from "../../../lib/models";
import {
  appendProvenanceHits,
  getAgentTurnContext,
  markTurnCapped,
  recordRagOutput,
  recordSemanticSearch,
} from "../../agent-turn-context";
import {
  getWorkloadBudget,
  workloadClassOrDefault,
} from "@neylonai/domain/billing";
import { meterEmbeddingUsage, meterModelResponse } from "../../metering";
import { knowledgeSearchProviders } from "../registry";
import type {
  KnowledgeSearchHit,
  KnowledgeSearchProvider,
} from "../types";

/** Query expansion only helps once the corpus is large enough to justify it. */
const QUERY_EXPANSION_MIN_CHUNKS = 100;
/** Hard cap on parallel vector searches when expansion is enabled. */
const MAX_SEARCH_QUERIES = 2;

function turnRagBudget() {
  const turn = getAgentTurnContext();
  const billing = turn.billing;
  const klass = workloadClassOrDefault(
    billing?.workloadClass ?? billing?.estimate?.estimatedClass ?? "standard",
  );
  const budget = getWorkloadBudget(klass);
  const chunkCount = turn.knowledgeChunkCount;
  const corpusLargeEnoughForExpansion =
    chunkCount != null && chunkCount > QUERY_EXPANSION_MIN_CHUNKS;
  return {
    klass,
    maxSearches: klass === "simple" ? 1 : 2,
    maxChunks: budget.ragChunks,
    maxChars: budget.ragChars,
    allowQueryExpansion:
      budget.allowQueryExpansion && corpusLargeEnoughForExpansion,
  };
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return content == null ? "" : String(content);
}

/** Free-tier Gemini text embeddings — default 3072 dims (matches halfvec schema). */
export const DEFAULT_EMBEDDING_MODEL = MODEL_DEFAULTS.embedding;

const EMBEDDING_MODEL_CACHE_MAX = 16;
const embeddingModels = new Map<string, GoogleGenerativeAIEmbeddings>();

function getQueryEmbeddingModel(apiKey: string): GoogleGenerativeAIEmbeddings {
  const existing = embeddingModels.get(apiKey);
  if (existing) {
    embeddingModels.delete(apiKey);
    embeddingModels.set(apiKey, existing);
    return existing;
  }

  const model = new GoogleGenerativeAIEmbeddings({
    model: getEmbeddingModel(),
    apiKey,
    taskType: TaskType.RETRIEVAL_QUERY,
  });
  embeddingModels.set(apiKey, model);
  while (embeddingModels.size > EMBEDDING_MODEL_CACHE_MAX) {
    const oldest = embeddingModels.keys().next().value;
    if (oldest === undefined) break;
    embeddingModels.delete(oldest);
  }
  return model;
}

async function expandQueries(question: string): Promise<string[]> {
  const prompt = PromptTemplate.fromTemplate(prompts.queryExpansion);
  const utilityModel = getUtilityModel();

  const llm = getProviderModel("simple", { temperature: 0.4 });
  const formatted = await prompt.format({ question });
  const response = await llm.invoke(formatted);
    meterModelResponse(utilityModel, response, {
      metadata: { purpose: "query_expansion" },
    });
    return messageText(response.content)
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, MAX_SEARCH_QUERIES - 1);
}

async function searchSingleQuery(
  query: string,
  organizationId: string,
  sourceIds: string[],
  canonicalPath?: string | null,
): Promise<KnowledgeSearchHit[]> {
  if (sourceIds.length === 0) return [];

  const embeddingModel = getEmbeddingModel();
  const embedding = await withGoogleApiRetry(async (apiKey) =>
    getQueryEmbeddingModel(apiKey).embedQuery(query),
  );
  meterEmbeddingUsage(embeddingModel, [query], {
    organizationId,
    metadata: { purpose: "knowledge_query_embedding" },
  });
  const hits = await searchKnowledgeByVector({
    organizationId,
    embedding,
    sourceIds,
    canonicalPath,
    limit: 5,
  });
  return hits.map((h) => ({
    chunkId: h.id,
    documentId: h.documentId,
    sourceId: h.sourceId,
    content: h.content,
    score: h.score,
    externalChunkId: h.externalChunkId,
  }));
}

/**
 * Resolve org from the authenticated agent turn context.
 * Never falls back to a global env organization.
 */
async function resolveTurnKnowledgeScope() {
  const turn = getAgentTurnContext();
  if (!turn.organizationId?.trim()) {
    console.error(
      "postgres knowledge search: missing organizationId on agent turn context (authenticate the request first)",
    );
    return null;
  }

  const scope = await resolveKnowledgeScope({
    organizationId: turn.organizationId,
  });

  if (!scope) {
    console.error(
      "postgres knowledge search: knowledge scope not found for authenticated organization",
      { organizationId: turn.organizationId },
    );
    return null;
  }

  return { scope, agentId: turn.agentId?.trim() || null };
}

/**
 * Knowledge search backed by Postgres/pgvector.
 * Gemini embeddings + query expansion + vector top-k + dedupe.
 * Filtered to sources allowed for the turn agent (fail closed).
 */
export const postgresKnowledgeSearchProvider: KnowledgeSearchProvider = {
  name: "postgres",
  async search(query: string): Promise<KnowledgeSearchHit[]> {
    try {
      const rag = turnRagBudget();
      const searchN = recordSemanticSearch();
      if (searchN > rag.maxSearches) {
        markTurnCapped("max_semantic_searches");
        return [];
      }

      const resolved = await resolveTurnKnowledgeScope();
      if (!resolved) return [];
      const { scope, agentId } = resolved;
      if (!agentId) {
        console.error(
          "postgres knowledge search: missing agentId on turn context",
        );
        return [];
      }

      const sourceIds = await listAllowedSourceIds(
        scope.organizationId,
        agentId,
      );
      if (sourceIds.length === 0) return [];

      const expandedQueries = rag.allowQueryExpansion
        ? await expandQueries(query)
        : [];
      const allQueries = rag.allowQueryExpansion
        ? [query, ...expandedQueries].slice(0, MAX_SEARCH_QUERIES)
        : [query];
      const pagePath = getAgentTurnContext().pagePath?.trim() || null;

      let resultSets = await Promise.all(
        allQueries.map((q) =>
          searchSingleQuery(q, scope.organizationId, sourceIds, pagePath).catch(
            () => [] as KnowledgeSearchHit[],
          ),
        ),
      );
      if (pagePath && resultSets.every((set) => set.length === 0)) {
        resultSets = await Promise.all(
          allQueries.map((q) =>
            searchSingleQuery(q, scope.organizationId, sourceIds).catch(
              () => [] as KnowledgeSearchHit[],
            ),
          ),
        );
      }

      const seen = new Set<string>();
      const unique: KnowledgeSearchHit[] = [];
      let chars = 0;
      for (const docs of resultSets) {
        for (const doc of docs) {
          if (!doc.content || seen.has(doc.chunkId)) continue;
          if (unique.length >= rag.maxChunks) {
            markTurnCapped("max_rag_chunks");
            break;
          }
          if (chars + doc.content.length > rag.maxChars) {
            markTurnCapped("max_rag_chars");
            break;
          }
          seen.add(doc.chunkId);
          unique.push(doc);
          chars += doc.content.length;
        }
        if (
          unique.length >= rag.maxChunks ||
          chars >= rag.maxChars
        ) {
          break;
        }
      }

      appendProvenanceHits(
        unique.map((h) => ({
          chunkId: h.chunkId,
          documentId: h.documentId,
          sourceId: h.sourceId,
          content: h.content,
          score: h.score,
          externalChunkId: h.externalChunkId,
        })),
      );
      recordRagOutput(chars);

      return unique;
    } catch (error) {
      console.error("postgres knowledge search provider error:", error);
      return [];
    }
  },
};

knowledgeSearchProviders.register(
  postgresKnowledgeSearchProvider.name,
  postgresKnowledgeSearchProvider,
);
