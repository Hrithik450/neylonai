/**
 * Centralized knowledge source provenance.
 */

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  knowledgeSourceAgents,
  knowledgeSources,
  organizationIntegrations,
} from "@neylonai/database";

export const SOURCE_VISIBILITY = ["public", "private"] as const;
export type SourceVisibility = (typeof SOURCE_VISIBILITY)[number];

export type ProvenanceChunkHit = {
  chunkId: string;
  documentId: string;
  sourceId: string | null;
  content: string;
  score?: number;
  externalChunkId?: string;
};

export type ProvenanceSourceRef = {
  id: string;
  type: string;
  name: string;
  visibility: SourceVisibility;
  publicUrl: string | null;
};

export type AnswerProvenance = {
  retrievedAt: string;
  agentId: string | null;
  chunks: Array<{
    chunkId: string;
    documentId: string;
    sourceId: string | null;
    score?: number;
  }>;
  sources: ProvenanceSourceRef[];
};

export type PublicAnswerProvenance = {
  sources: Array<{
    name: string;
    type: string;
    publicUrl: string | null;
  }>;
};

export function normalizeSourceVisibility(
  value: unknown,
): SourceVisibility {
  return value === "public" ? "public" : "private";
}

export function publicUrlFromWebsite(
  websiteUrl: string | null,
  visibility: SourceVisibility = "public",
): string | null {
  if (visibility !== "public" || !websiteUrl?.trim()) return null;
  try {
    const parsed = new URL(websiteUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function listAllowedSourceIds(
  organizationId: string,
  agentId: string,
): Promise<string[]> {
  const org = organizationId.trim();
  const agent = agentId.trim();
  if (!org || !agent) return [];

  const rows = await db
    .select({ sourceId: knowledgeSourceAgents.source_id })
    .from(knowledgeSourceAgents)
    .innerJoin(
      knowledgeSources,
      and(
        eq(knowledgeSources.id, knowledgeSourceAgents.source_id),
        eq(
          knowledgeSources.organization_id,
          knowledgeSourceAgents.organization_id,
        ),
      ),
    )
    .innerJoin(
      organizationIntegrations,
      and(
        eq(
          organizationIntegrations.id,
          knowledgeSources.organization_integration_id,
        ),
        eq(
          organizationIntegrations.organization_id,
          knowledgeSources.organization_id,
        ),
      ),
    )
    .where(
      and(
        eq(knowledgeSourceAgents.organization_id, org),
        eq(knowledgeSourceAgents.agent_id, agent),
        eq(organizationIntegrations.enabled, true),
      ),
    );

  return [...new Set(rows.map((r) => r.sourceId))];
}

async function loadSourcesByIds(
  organizationId: string,
  sourceIds: string[],
): Promise<Map<string, ProvenanceSourceRef>> {
  const map = new Map<string, ProvenanceSourceRef>();
  const unique = [...new Set(sourceIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const rows = await db
    .select({
      id: knowledgeSources.id,
      sourceType: knowledgeSources.source_type,
      organizationIntegrationId: knowledgeSources.organization_integration_id,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.organization_id, organizationId),
        inArray(knowledgeSources.id, unique),
      ),
    );

  const oiIds = rows.map((r) => r.organizationIntegrationId);
  const oiRows =
    oiIds.length === 0
      ? []
      : await db
          .select({
            id: organizationIntegrations.id,
            config: organizationIntegrations.config,
          })
          .from(organizationIntegrations)
          .where(
            and(
              eq(organizationIntegrations.organization_id, organizationId),
              inArray(organizationIntegrations.id, oiIds),
            ),
          );
  const oiConfig = new Map(
    oiRows.map((r) => [r.id, (r.config ?? {}) as Record<string, unknown>]),
  );

  for (const row of rows) {
    const cfg = oiConfig.get(row.organizationIntegrationId) ?? {};
    const websiteUrl =
      typeof cfg.url === "string" && cfg.url.trim() ? cfg.url.trim() : null;
    const visibility: SourceVisibility =
      row.sourceType === "website" ? "public" : "private";
    const name =
      row.sourceType === "website"
        ? websiteUrl || "Website"
        : row.sourceType === "pdf"
          ? "PDF"
          : "Integration knowledge";
    map.set(row.id, {
      id: row.id,
      type: row.sourceType,
      name,
      visibility,
      publicUrl: publicUrlFromWebsite(websiteUrl, visibility),
    });
  }
  return map;
}

export async function toDashboardProvenance(input: {
  organizationId: string;
  agentId?: string | null;
  hits: ProvenanceChunkHit[];
}): Promise<AnswerProvenance | null> {
  if (!input.hits.length) return null;

  const sourceIds = input.hits
    .map((h) => h.sourceId)
    .filter((id): id is string => Boolean(id));
  const sourceMap = await loadSourcesByIds(input.organizationId, sourceIds);

  const seenChunk = new Set<string>();
  const chunks: AnswerProvenance["chunks"] = [];
  for (const hit of input.hits) {
    if (seenChunk.has(hit.chunkId)) continue;
    seenChunk.add(hit.chunkId);
    chunks.push({
      chunkId: hit.chunkId,
      documentId: hit.documentId,
      sourceId: hit.sourceId,
      ...(typeof hit.score === "number" ? { score: hit.score } : {}),
    });
  }

  const seenSource = new Set<string>();
  const sources: ProvenanceSourceRef[] = [];
  for (const hit of input.hits) {
    if (!hit.sourceId || seenSource.has(hit.sourceId)) continue;
    seenSource.add(hit.sourceId);
    const ref = sourceMap.get(hit.sourceId);
    if (ref) sources.push(ref);
  }

  return {
    retrievedAt: new Date().toISOString(),
    agentId: input.agentId ?? null,
    chunks,
    sources,
  };
}

export function toPublicProvenance(
  provenance: AnswerProvenance | null | undefined,
): PublicAnswerProvenance | null {
  if (!provenance?.sources.length) return null;
  const sources = provenance.sources
    .filter((s) => s.visibility === "public")
    .map((s) => ({
      name: s.name,
      type: s.type,
      publicUrl: s.publicUrl,
    }));
  if (sources.length === 0) return null;
  return { sources };
}

export function stripProvenanceForPublic<T extends Record<string, unknown>>(
  metadata: T | null | undefined,
): T | null | undefined {
  if (!metadata || typeof metadata !== "object") return metadata;
  const { provenance: _p, ...rest } = metadata as T & {
    provenance?: unknown;
  };
  return rest as T;
}

export function readAnswerProvenance(
  metadata: Record<string, unknown> | null | undefined,
): AnswerProvenance | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.provenance;
  if (!raw || typeof raw !== "object") return null;
  return raw as AnswerProvenance;
}
