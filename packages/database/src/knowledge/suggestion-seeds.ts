import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "../postgres/client";
import {
  knowledgeChunks,
  knowledgeDocuments,
} from "../postgres/schema/knowledge";
import { cacheGet, cacheSet } from "../redis/cache";

export interface KnowledgeSuggestionSeed {
  documentId: string;
  title: string | null;
  /** Short excerpt from the first chunk — never raw internal metadata. */
  excerpt: string;
}

export interface ListKnowledgeSuggestionSeedsInput {
  organizationId: string;
  limit?: number;
  /** When true (default), cache org candidate seeds (never visitor-scoped). */
  useCache?: boolean;
}

function requireId(name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required for knowledge suggestion seeds`);
  }
  return trimmed;
}

function seedsCacheKey(organizationId: string, limit: number): string {
  const digest = createHash("sha256")
    .update(`${organizationId}:${limit}`)
    .digest("hex")
    .slice(0, 24);
  return `kb-suggestion-seeds:v2:${digest}`;
}

/**
 * Lightweight org document samples for proactive candidate generation
 * (no embeddings). Shared across visitors of the same organization.
 *
 * Always filters by organization_id.
 */
export async function listKnowledgeSuggestionSeeds(
  options: ListKnowledgeSuggestionSeedsInput,
): Promise<KnowledgeSuggestionSeed[]> {
  const organizationId = requireId("organizationId", options.organizationId);
  const limit = Math.min(Math.max(options.limit ?? 24, 4), 48);
  const useCache = options.useCache !== false;

  const cacheKey = seedsCacheKey(organizationId, limit);
  if (useCache) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as KnowledgeSuggestionSeed[];
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore bad cache
      }
    }
  }

  const tenantDoc = eq(knowledgeDocuments.organization_id, organizationId);
  const tenantChunk = eq(knowledgeChunks.organization_id, organizationId);

  const docs = await db
    .select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.canonical_path,
    })
    .from(knowledgeDocuments)
    .where(tenantDoc)
    .orderBy(desc(knowledgeDocuments.updated_at))
    .limit(limit);

  if (docs.length === 0) return [];

  const seeds: KnowledgeSuggestionSeed[] = [];

  for (const doc of docs) {
    const [chunk] = await db
      .select({
        content: knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .where(and(tenantChunk, eq(knowledgeChunks.document_id, doc.id)))
      .orderBy(knowledgeChunks.chunk_index)
      .limit(1);

    const excerpt = (chunk?.content ?? "")
      .replace(/^content:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);

    if (!doc.title?.trim() && excerpt.length < 24) continue;

    seeds.push({
      documentId: doc.id,
      title: doc.title?.trim() || null,
      excerpt,
    });
  }

  if (seeds.length < 6) {
    const extras = await db
      .select({
        documentId: knowledgeChunks.document_id,
        content: knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .where(tenantChunk)
      .orderBy(sql`random()`)
      .limit(12);

    const seen = new Set(seeds.map((s) => s.documentId));
    for (const row of extras) {
      if (seen.has(row.documentId)) continue;
      const excerpt = row.content
        .replace(/^content:\s*/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
      if (excerpt.length < 24) continue;
      seen.add(row.documentId);
      seeds.push({
        documentId: row.documentId,
        title: null,
        excerpt,
      });
      if (seeds.length >= limit) break;
    }
  }

  if (useCache && seeds.length > 0) {
    await cacheSet(cacheKey, JSON.stringify(seeds), 600);
  }

  return seeds;
}
