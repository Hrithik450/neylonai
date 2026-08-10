/**
 * Multi-tenant vector-search micro-benchmark for Postgres/pgvector.
 *
 * Measures filtered HNSW latency under realistic org scoping.
 * Does NOT change production schema — read-only against an existing scope,
 * or optional synthetic seed when BENCH_SEED=1.
 *
 * Usage (from repo root, with DATABASE_URL / DATABASE_DIRECT_URL set):
 *   pnpm --filter @neylonai/database bench:vector-search
 *
 * Env:
 *   KNOWLEDGE_ORGANIZATION_SLUG — **dev script only**
 *   BENCH_QUERIES — number of ANN queries (default 30)
 *   BENCH_LIMIT — top-k (default 10)
 *   BENCH_EF_SEARCH — hnsw.ef_search (default 100)
 *   BENCH_SEED=1 — insert ephemeral random halfvec rows (cleaned up after)
 *   BENCH_SEED_COUNT — synthetic rows when seeding (default 5000)
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeSources,
  organizationIntegrations,
  resolveDevKnowledgeScope,
  searchKnowledgeByVector,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "../src/index";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function randomUnitEmbedding(dims: number): number[] {
  const v = Array.from({ length: dims }, () => Math.random() * 2 - 1);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

async function countChunks(organizationId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.organization_id, organizationId));
  return Number(row?.n ?? 0);
}

async function seedSynthetic(params: {
  organizationId: string;
  count: number;
}): Promise<{ documentId: string; sourceId: string; chunkIds: string[] }> {
  const [oi] = await db
    .insert(organizationIntegrations)
    .values({
      organization_id: params.organizationId,
      integration_type: "bench",
      enabled: true,
      config: { bench: true },
    })
    .returning({ id: organizationIntegrations.id });
  if (!oi) throw new Error("Failed to insert benchmark org integration");

  const [source] = await db
    .insert(knowledgeSources)
    .values({
      organization_id: params.organizationId,
      organization_integration_id: oi.id,
      source_type: "bench",
      document_count: 0,
    })
    .returning({ id: knowledgeSources.id });
  if (!source) throw new Error("Failed to insert benchmark source");

  const externalDocId = `bench-doc-${Date.now()}`;
  const [doc] = await db
    .insert(knowledgeDocuments)
    .values({
      organization_id: params.organizationId,
      source_id: source.id,
      external_doc_id: externalDocId,
      name: "vector-search benchmark (ephemeral)",
      raw_content: "benchmark seed",
      chunks_count: params.count,
    })
    .returning({ id: knowledgeDocuments.id });

  if (!doc) throw new Error("Failed to insert benchmark document");

  const chunkIds: string[] = [];
  const batchSize = 50;
  for (let i = 0; i < params.count; i += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, params.count - i) },
      (_, j) => {
        const idx = i + j;
        return {
          organization_id: params.organizationId,
          document_id: doc.id,
          external_chunk_id: `bench-chunk-${idx}`,
          chunk_index: idx,
          content: `Benchmark chunk ${idx}`,
          embedding: randomUnitEmbedding(KNOWLEDGE_EMBEDDING_DIMENSIONS),
        };
      },
    );
    const inserted = await db
      .insert(knowledgeChunks)
      .values(batch)
      .returning({ id: knowledgeChunks.id });
    chunkIds.push(...inserted.map((r) => r.id));
  }

  return { documentId: doc.id, sourceId: source.id, chunkIds };
}

async function cleanupSynthetic(documentId: string, sourceId: string) {
  await db
    .delete(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId));
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, sourceId));
}

async function main() {
  const queries = Number(process.env.BENCH_QUERIES ?? 30);
  const limit = Number(process.env.BENCH_LIMIT ?? 10);
  const efSearch = Number(process.env.BENCH_EF_SEARCH ?? 100);
  const seed = process.env.BENCH_SEED === "1";
  const seedCount = Number(process.env.BENCH_SEED_COUNT ?? 5000);

  const scope = await resolveDevKnowledgeScope();
  if (!scope) {
    console.error(
      "Scope not found. For this **dev** benchmark set KNOWLEDGE_ORGANIZATION_SLUG, or seed org data.",
    );
    process.exit(1);
  }

  let seededDocumentId: string | null = null;
  let seededSourceId: string | null = null;
  try {
    if (seed) {
      console.log(`Seeding ${seedCount} synthetic chunks…`);
      const seeded = await seedSynthetic({
        organizationId: scope.organizationId,
        count: seedCount,
      });
      seededDocumentId = seeded.documentId;
      seededSourceId = seeded.sourceId;
    }

    const tenantChunks = await countChunks(scope.organizationId);
    const [globalRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(knowledgeChunks);
    const globalChunks = Number(globalRow?.n ?? 0);

    const sourceRows = await db
      .select({ id: knowledgeSources.id })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.organization_id, scope.organizationId));
    const sourceIds = sourceRows.map((r) => r.id);

    console.log(
      JSON.stringify(
        {
          organizationSlug: scope.organizationSlug,
          tenantChunks,
          globalChunks,
          tenantShare:
            globalChunks === 0
              ? 0
              : Number((tenantChunks / globalChunks).toFixed(4)),
          sourceCount: sourceIds.length,
          queries,
          limit,
          efSearch,
        },
        null,
        2,
      ),
    );

    if (tenantChunks === 0 || sourceIds.length === 0) {
      console.error(
        "No chunks/sources in scope — seed with BENCH_SEED=1 or import data.",
      );
      process.exit(1);
    }

    const latencies: number[] = [];
    const hitCounts: number[] = [];

    for (let i = 0; i < queries; i++) {
      const embedding = randomUnitEmbedding(KNOWLEDGE_EMBEDDING_DIMENSIONS);
      const t0 = performance.now();
      const hits = await searchKnowledgeByVector({
        organizationId: scope.organizationId,
        embedding,
        sourceIds,
        limit,
        efSearch,
      });
      latencies.push(performance.now() - t0);
      hitCounts.push(hits.length);
    }

    latencies.sort((a, b) => a - b);
    const underfilled = hitCounts.filter(
      (n) => n < Math.min(limit, tenantChunks),
    ).length;

    console.log(
      JSON.stringify(
        {
          latencyMs: {
            p50: Number(percentile(latencies, 50).toFixed(2)),
            p95: Number(percentile(latencies, 95).toFixed(2)),
            p99: Number(percentile(latencies, 99).toFixed(2)),
            max: Number(latencies[latencies.length - 1]!.toFixed(2)),
          },
          avgHits: Number(
            (
              hitCounts.reduce((a, b) => a + b, 0) / hitCounts.length
            ).toFixed(2),
          ),
          underfilledQueries: underfilled,
          note:
            "Underfilled queries (hits < min(limit, tenantChunks)) indicate filtered-ANN exhaustion — raise ef_search / max_scan_tuples or isolate the tenant.",
        },
        null,
        2,
      ),
    );
  } finally {
    if (seededDocumentId && seededSourceId) {
      console.log("Cleaning up synthetic benchmark document…");
      await cleanupSynthetic(seededDocumentId, seededSourceId);
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
