import {
  knowledgeChunks,
  knowledgeDocuments,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "../postgres/schema/knowledge";
import { db } from "../postgres/client";
import { and, cosineDistance, eq, inArray, sql } from "drizzle-orm";

export interface KnowledgeSearchHit {
  id: string;
  content: string;
  documentId: string;
  sourceId: string | null;
  externalChunkId: string;
  /** Cosine distance (lower = more similar). */
  distance: number;
  /** 1 - distance, convenient for fusion / ranking. */
  score: number;
}

export interface VectorSearchInput {
  organizationId: string;
  embedding: number[];
  limit?: number;
  /**
   * Agent-allowed knowledge_sources ids. Required for retrieval isolation.
   * Empty array → no hits (fail closed).
   */
  sourceIds: string[];
  /** HNSW ef_search (default 100). Higher = better recall, slower. */
  efSearch?: number;
  /**
   * Cap on tuples visited during iterative filtered HNSW scans
   * (`hnsw.max_scan_tuples`, default 20_000). Raise only if small tenants
   * under-recall under heavy global index skew.
   */
  maxScanTuples?: number;
}

function requireTenantId(name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required for knowledge vector search`);
  }
  return trimmed;
}

/**
 * Approximate nearest-neighbor search scoped to one org + allowed sources.
 * Uses HNSW + cosine distance on halfvec(3072).
 *
 * Always filters by organization_id and document.source_id ∈ sourceIds.
 */
export async function searchKnowledgeByVector(
  input: VectorSearchInput,
): Promise<KnowledgeSearchHit[]> {
  const organizationId = requireTenantId(
    "organizationId",
    input.organizationId,
  );
  const sourceIds = [...new Set(input.sourceIds.map((id) => id.trim()).filter(Boolean))];
  if (sourceIds.length === 0) return [];

  const {
    embedding,
    limit = 10,
    efSearch = 100,
    maxScanTuples = 20_000,
  } = input;

  if (embedding.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding length ${KNOWLEDGE_EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
    );
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('hnsw.ef_search', ${String(efSearch)}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`,
    );
    await tx.execute(
      sql`SELECT set_config('hnsw.max_scan_tuples', ${String(maxScanTuples)}, true)`,
    );

    const distanceExpr = cosineDistance(knowledgeChunks.embedding, embedding);

    const rows = await tx
      .select({
        id: knowledgeChunks.id,
        content: knowledgeChunks.content,
        documentId: knowledgeChunks.document_id,
        sourceId: knowledgeDocuments.source_id,
        externalChunkId: knowledgeChunks.external_chunk_id,
        distance: sql<number>`${distanceExpr}`,
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
        ),
      )
      .orderBy(distanceExpr)
      .limit(limit);

    return rows.map((row) => {
      const distance = Number(row.distance);
      return {
        id: row.id,
        content: row.content,
        documentId: row.documentId,
        sourceId: row.sourceId ?? null,
        externalChunkId: row.externalChunkId,
        distance,
        score: 1 - distance,
      };
    });
  });
}
