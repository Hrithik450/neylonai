/**
 * Knowledge ingest: chunk text → embed → store under org knowledge.
 */

import { and, eq, inArray } from "drizzle-orm";
import {
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "@neylonai/database";
import { withGoogleApiRetry } from "@neylonai/integrations";
import {
  catalogIntegrationIdForSource,
  refreshSourceDocumentCount,
  setSourceAgents,
} from "./service";
import { DEFAULT_CHATBOT_AGENT_ID } from "./types";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 16;
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

export function chunkPlainText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    const end = Math.min(normalized.length, i + CHUNK_SIZE);
    let slice = normalized.slice(i, end);
    if (end < normalized.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" "),
      );
      if (lastBreak > CHUNK_SIZE * 0.4) {
        slice = slice.slice(0, lastBreak + 1);
      }
    }
    const trimmed = slice.trim();
    if (trimmed) chunks.push(trimmed);
    if (end >= normalized.length) break;
    i += Math.max(1, trimmed.length - CHUNK_OVERLAP);
  }
  return chunks;
}

async function embedDocuments(texts: string[]): Promise<number[][]> {
  const model = process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const vectors = await withGoogleApiRetry(async (apiKey) => {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        model,
        apiKey,
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });
      return embeddings.embedDocuments(batch);
    });
    for (const vec of vectors) {
      if (!vec || vec.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch (expected ${KNOWLEDGE_EMBEDDING_DIMENSIONS}).`,
        );
      }
      all.push(vec);
    }
  }
  return all;
}

export type IngestDocumentInput = {
  externalDocId: string;
  name: string;
  text: string;
  /** Object storage key when the original file is retained (e.g. PDF). */
  storageKey?: string | null;
};

export type IngestSourceInput = {
  organizationId: string;
  sourceId: string;
  documents: IngestDocumentInput[];
  /** Catalog id (pdf, website, …). Resolved from source when omitted. */
  catalogIntegrationId?: string;
  agentIds?: string[];
  /**
   * When true (default), replace all docs for this source.
   * When false, only replace docs whose externalDocId collides (append PDFs).
   */
  replaceAll?: boolean;
};

export async function ingestDocumentsForSource(
  input: IngestSourceInput,
): Promise<{ documentCount: number; chunkCount: number }> {
  const { organizationId, sourceId } = input;
  if (!input.documents.length) {
    throw new Error("Nothing to ingest.");
  }

  const catalogIntegrationId =
    input.catalogIntegrationId ??
    (await catalogIntegrationIdForSource(organizationId, sourceId));
  if (!catalogIntegrationId) {
    throw new Error(
      "Cannot ingest: knowledge source is not linked to an integration.",
    );
  }

  await setSourceAgents(
    organizationId,
    sourceId,
    input.agentIds?.length ? input.agentIds : [DEFAULT_CHATBOT_AGENT_ID],
  );

  const existing = await db
    .select({
      id: knowledgeDocuments.id,
      externalDocId: knowledgeDocuments.external_doc_id,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, organizationId),
        eq(knowledgeDocuments.source_id, sourceId),
      ),
    );

  const incomingExternal = new Set(
    input.documents.map((d) => d.externalDocId.slice(0, 255)),
  );
  const toRemove = input.replaceAll !== false
    ? existing.map((d) => d.id)
    : existing
        .filter((d) => incomingExternal.has(d.externalDocId))
        .map((d) => d.id);

  if (toRemove.length > 0) {
    await db.delete(knowledgeDocuments).where(
      and(
        eq(knowledgeDocuments.organization_id, organizationId),
        inArray(knowledgeDocuments.id, toRemove),
      ),
    );
  }

  let chunkCount = 0;
  let documentCount = 0;
  for (const doc of input.documents) {
    const parts = chunkPlainText(doc.text);
    if (parts.length === 0) continue;

    const [row] = await db
      .insert(knowledgeDocuments)
      .values({
        organization_id: organizationId,
        source_id: sourceId,
        external_doc_id: doc.externalDocId.slice(0, 255),
        name: doc.name.slice(0, 500),
        raw_content: doc.text,
        chunks_count: parts.length,
        storage_key: doc.storageKey ?? null,
      })
      .returning();

    const vectors = await embedDocuments(parts);
    await db.insert(knowledgeChunks).values(
      parts.map((content, idx) => ({
        organization_id: organizationId,
        document_id: row!.id,
        external_chunk_id: `${doc.externalDocId}:c${idx}`.slice(0, 255),
        chunk_index: idx,
        content,
        embedding: vectors[idx]!,
      })),
    );
    chunkCount += parts.length;
    documentCount += 1;
  }

  if (documentCount === 0) {
    throw new Error("No ingestible text content found.");
  }

  await refreshSourceDocumentCount(organizationId, sourceId);

  return { documentCount, chunkCount };
}
