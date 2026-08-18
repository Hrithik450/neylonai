/**
 * Knowledge ingest: chunk text → embed → store under org knowledge.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
  knowledgePageSections,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "@neylonai/database";
import { withGoogleApiRetry } from "@neylonai/integrations";
import {
  enforceSectionSizeLimit,
  hashPageContent,
  type ScrapeProvider,
  type WebsitePageSection,
} from "@neylonai/integrations/website";
import {
  catalogIntegrationIdForSource,
  refreshSourceDocumentCount,
  setSourceAgents,
} from "./service";
import { MAIN_AGENT_KEY } from "../agents/org-agents.types";

const APPROX_CHARS_PER_TOKEN = 4;
/** Target chunk length in tokens (approx via chars). */
const CHUNK_SIZE_TOKENS = 800;
const CHUNK_OVERLAP_TOKENS = 100;
const CHUNK_SIZE = CHUNK_SIZE_TOKENS * APPROX_CHARS_PER_TOKEN;
const CHUNK_OVERLAP = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;
const EMBED_MAX_BATCH_ITEMS = 100;
const EMBEDDING_TPM_DEFAULT = 30_000;
const BATCH_UTILIZATION_DEFAULT = 0.7;
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
  const configuredTpm = Number(process.env.EMBEDDING_MODEL_TPM);
  const tpm =
    Number.isFinite(configuredTpm) && configuredTpm > 0
      ? configuredTpm
      : EMBEDDING_TPM_DEFAULT;
  const configuredUtilization = Number(
    process.env.GEMINI_BATCH_TPM_UTILIZATION,
  );
  const utilization = Number.isFinite(configuredUtilization)
    ? Math.min(Math.max(configuredUtilization, 0.1), 0.9)
    : BATCH_UTILIZATION_DEFAULT;
  const tokenBudget = Math.floor(tpm * utilization);

  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;
  for (const text of texts) {
    const tokens = Math.max(1, Math.ceil(text.length / APPROX_CHARS_PER_TOKEN));
    if (
      current.length > 0 &&
      (current.length >= EMBED_MAX_BATCH_ITEMS ||
        currentTokens + tokens > tokenBudget)
    ) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(text);
    currentTokens += tokens;
  }
  if (current.length) batches.push(current);

  const all: number[][] = [];
  for (const batch of batches) {
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
  text: string;
  canonicalUrl?: string | null;
  canonicalPath?: string | null;
};

export type IngestSourceInput = {
  organizationId: string;
  sourceId: string;
  documents: IngestDocumentInput[];
  /** Catalog integration id. Resolved from the source when omitted. */
  catalogIntegrationId?: string;
  agentIds?: string[];
  /**
   * When true (default), replace all docs for this source.
   * When false, only replace documents whose externalDocId collides.
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
    input.agentIds?.length ? input.agentIds : [MAIN_AGENT_KEY],
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
        canonical_path:
          doc.canonicalPath?.trim() || doc.canonicalUrl?.trim() || null,
        raw_content: doc.text,
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

export type WebsiteSectioner = "gemini" | "heuristic";

export type WebsitePageIngestInput = {
  organizationId: string;
  sourceId: string;
  url: string;
  path: string;
  provider: ScrapeProvider;
  sectioner: WebsiteSectioner;
  text: string;
  lastmod: string | null;
  contentHash: string;
  sections: WebsitePageSection[];
};

export function buildWebsiteChunkParts(
  sections: WebsitePageSection[],
): Array<{ sectionId: string; content: string }> {
  return enforceSectionSizeLimit(sections).map((section) => ({
    sectionId: section.sectionId,
    content: section.content,
  }));
}

async function replacePageSections(input: {
  organizationId: string;
  documentId: string;
  provider: WebsitePageIngestInput["provider"];
  sectioner: WebsiteSectioner;
  sections: WebsitePageSection[];
}): Promise<void> {
  const sections = input.sections.map((section, position) => ({
    organization_id: input.organizationId,
    document_id: input.documentId,
    section_key: section.sectionId,
    content: section.content,
    provider: input.provider,
    sectioner: input.sectioner,
    suggestions: section.suggestions.slice(0, 4),
    position,
  }));

  await db
    .delete(knowledgePageSections)
    .where(eq(knowledgePageSections.document_id, input.documentId));
  if (sections.length) {
    await db.insert(knowledgePageSections).values(sections);
  }
}

/**
 * Upsert one canonical website page. Embeds first so a failed refresh
 * keeps the previous usable document.
 */
export async function ingestWebsitePage(
  input: WebsitePageIngestInput,
): Promise<{ skipped: boolean; reason?: "hash"; chunkCount: number }> {
  const path = input.path.trim() || "/";
  const sections = enforceSectionSizeLimit(input.sections);
  if (sections.length === 0) {
    throw new Error("No ingestible website sections found.");
  }
  const [existing] = await db
    .select({
      id: knowledgeDocuments.id,
      rawContent: knowledgeDocuments.raw_content,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, input.organizationId),
        eq(knowledgeDocuments.source_id, input.sourceId),
        eq(knowledgeDocuments.canonical_path, path),
      ),
    )
    .limit(1);

  const existingHash =
    typeof existing?.rawContent === "string" && existing.rawContent.length > 0
      ? hashPageContent(existing.rawContent)
      : null;

  if (
    existingHash &&
    existingHash === input.contentHash &&
    typeof existing?.rawContent === "string" &&
    existing.rawContent.length > 0
  ) {
    const storedChunks = await db
      .select({ content: knowledgeChunks.content })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.document_id, existing.id))
      .orderBy(asc(knowledgeChunks.chunk_index));
    const chunksAligned =
      storedChunks.length === sections.length &&
      storedChunks.every(
        (chunk, index) => chunk.content === sections[index]?.content,
      );
    if (chunksAligned) {
      const [storedSection] = await db
        .select({ id: knowledgePageSections.id })
        .from(knowledgePageSections)
        .where(eq(knowledgePageSections.document_id, existing.id))
        .limit(1);
      if (!storedSection) {
        await replacePageSections({
          organizationId: input.organizationId,
          documentId: existing.id,
          provider: input.provider,
          sectioner: input.sectioner,
          sections,
        });
      }
      await db
        .update(knowledgeDocuments)
        .set({
          updated_at: new Date(),
        })
        .where(eq(knowledgeDocuments.id, existing.id));
      return { skipped: true, reason: "hash", chunkCount: 0 };
    }
  }

  const chunkParts = buildWebsiteChunkParts(sections);
  const vectors = await embedDocuments(chunkParts.map((part) => part.content));
  const externalDocId =
    `website:${Buffer.from(input.url).toString("base64url").slice(0, 80)}`.slice(
      0,
      255,
    );

  await db.transaction(async (tx) => {
    const documentId = existing?.id
      ? existing.id
      : (
          await tx
            .insert(knowledgeDocuments)
            .values({
              organization_id: input.organizationId,
              source_id: input.sourceId,
              external_doc_id: externalDocId,
              canonical_path: path,
              raw_content: input.text,
            })
            .returning({ id: knowledgeDocuments.id })
        )[0]!.id;

    if (existing?.id) {
      await tx
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.document_id, existing.id));
      await tx
        .update(knowledgeDocuments)
        .set({
          external_doc_id: externalDocId,
          canonical_path: path,
          raw_content: input.text,
          updated_at: new Date(),
        })
        .where(eq(knowledgeDocuments.id, existing.id));
    }

    await tx.insert(knowledgeChunks).values(
      chunkParts.map((part, idx) => ({
        organization_id: input.organizationId,
        document_id: documentId,
        external_chunk_id: `${externalDocId}:s:${part.sectionId}`.slice(
          0,
          255,
        ),
        chunk_index: idx,
        content: part.content,
        embedding: vectors[idx]!,
      })),
    );

    await tx
      .delete(knowledgePageSections)
      .where(eq(knowledgePageSections.document_id, documentId));
    await tx.insert(knowledgePageSections).values(
      sections.map((section, position) => ({
        organization_id: input.organizationId,
        document_id: documentId,
        section_key: section.sectionId,
        content: section.content,
        provider: input.provider,
        sectioner: input.sectioner,
        suggestions: section.suggestions.slice(0, 4),
        position,
      })),
    );
  });

  return { skipped: false, chunkCount: chunkParts.length };
}

export async function deleteWebsiteDocumentsNotInPaths(input: {
  organizationId: string;
  sourceId: string;
  selectedPaths: string[];
}): Promise<number> {
  const existing = await db
    .select({
      id: knowledgeDocuments.id,
      path: knowledgeDocuments.canonical_path,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, input.organizationId),
        eq(knowledgeDocuments.source_id, input.sourceId),
      ),
    );
  const keep = new Set(input.selectedPaths);
  // Null-path rows are leftovers from older single-page website imports;
  // they must be removed too or Stored stays higher than this crawl's pages.
  const toRemove = existing
    .filter((row) => !row.path || !keep.has(row.path))
    .map((row) => row.id);
  if (toRemove.length === 0) return 0;
  await db.delete(knowledgeDocuments).where(
    and(
      eq(knowledgeDocuments.organization_id, input.organizationId),
      inArray(knowledgeDocuments.id, toRemove),
    ),
  );
  return toRemove.length;
}
