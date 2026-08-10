import { db } from "../postgres/client";
import {
  knowledgeChunks,
  knowledgeDocuments,
} from "../postgres/schema/knowledge";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface KeywordSearchHit {
  id: string;
  content: string;
  documentId: string;
  sourceId: string | null;
  externalChunkId: string;
  rank: number;
}

export interface KeywordSearchInput {
  organizationId: string;
  query: string;
  /** Agent-allowed source ids. Empty → no hits (fail closed). */
  sourceIds: string[];
  limit?: number;
}

/**
 * Keyword retrieval via PostgreSQL FTS (tsvector + GIN + ts_rank_cd).
 * Scoped to org + allowed sources — same isolation as vector search.
 */
export async function searchKnowledgeByKeyword(
  input: KeywordSearchInput,
): Promise<KeywordSearchHit[]> {
  const { organizationId, query, limit = 5 } = input;
  const sourceIds = [
    ...new Set(input.sourceIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (sourceIds.length === 0) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      documentId: knowledgeChunks.document_id,
      sourceId: knowledgeDocuments.source_id,
      externalChunkId: knowledgeChunks.external_chunk_id,
      rank: sql<number>`ts_rank_cd(${knowledgeChunks.content_tsv}, plainto_tsquery('english', ${trimmed}))`,
    })
    .from(knowledgeChunks)
    .innerJoin(
      knowledgeDocuments,
      and(
        eq(knowledgeDocuments.id, knowledgeChunks.document_id),
        eq(knowledgeDocuments.organization_id, knowledgeChunks.organization_id),
      ),
    )
    .where(
      and(
        eq(knowledgeChunks.organization_id, organizationId),
        inArray(knowledgeDocuments.source_id, sourceIds),
        sql`${knowledgeChunks.content_tsv} @@ plainto_tsquery('english', ${trimmed})`,
      ),
    )
    .orderBy(
      sql`ts_rank_cd(${knowledgeChunks.content_tsv}, plainto_tsquery('english', ${trimmed})) DESC`,
    )
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    documentId: row.documentId,
    sourceId: row.sourceId ?? null,
    externalChunkId: row.externalChunkId,
    rank: Number(row.rank),
  }));
}
