import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  knowledgeDocuments,
  knowledgeSourceAgents,
  knowledgeSources,
  organizationIntegrations,
  organizations,
} from "@neylonai/database";
import { assertPublicHttpUrl as assertPublicHttpUrlParsed } from "@neylonai/integrations/scrape";
import { MAIN_AGENT_KEY, KNOWN_AGENT_KEYS } from "../agents/org-agents.types";
import type {
  CreateIntegrationSourceInput,
  CreateWebsiteSourceInput,
  KnowledgeSourceRecord,
  UpdateKnowledgeSourceInput,
} from "./types";

function assertPublicHttpUrl(raw: string): string {
  return assertPublicHttpUrlParsed(raw).toString();
}

function configUrl(
  config: Record<string, unknown> | null | undefined,
): string | null {
  const url = config?.url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function mapSource(
  row: typeof knowledgeSources.$inferSelect,
  sourceType: string,
  documentCount: number,
  agentIds: string[],
  websiteUrl: string | null = null,
): KnowledgeSourceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceType,
    organizationIntegrationId: row.organization_integration_id,
    websiteUrl,
    documentCount,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    agentIds,
    createdAt: row.created_at?.toISOString() ?? null,
  };
}

const KNOWN_AGENT_KEY_SET = new Set<string>(KNOWN_AGENT_KEYS);

/** Resolve code-registry agent keys (e.g. `main-agent`). */
export async function resolveAgentKeys(refs: string[]): Promise<string[]> {
  const unique = [...new Set(refs.map((r) => r.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  for (const ref of unique) {
    if (!KNOWN_AGENT_KEY_SET.has(ref)) {
      throw new Error(`Unknown agent: ${ref}`);
    }
  }
  return unique;
}

function defaultKnowledgeAgentKeys(): string[] {
  return [MAIN_AGENT_KEY];
}

async function websiteUrlsForIntegrations(
  organizationId: string,
  organizationIntegrationIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (organizationIntegrationIds.length === 0) return map;
  const rows = await db
    .select({
      id: organizationIntegrations.id,
      config: organizationIntegrations.config,
    })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, organizationId),
        inArray(organizationIntegrations.id, organizationIntegrationIds),
      ),
    );
  for (const r of rows) {
    map.set(r.id, configUrl(r.config as Record<string, unknown>));
  }
  return map;
}

export function getOrgEmbeddingDefaults(): {
  embeddingModel: string;
  embeddingDimensions: number;
} {
  return {
    embeddingModel:
      process.env.EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    embeddingDimensions: 3072,
  };
}

export async function setSourceAgents(
  organizationId: string,
  sourceId: string,
  agentKeys: string[],
): Promise<void> {
  const resolved = await resolveAgentKeys(agentKeys);
  await db
    .delete(knowledgeSourceAgents)
    .where(
      and(
        eq(knowledgeSourceAgents.organization_id, organizationId),
        eq(knowledgeSourceAgents.source_id, sourceId),
      ),
    );
  if (resolved.length === 0) return;
  await db.insert(knowledgeSourceAgents).values(
    resolved.map((agent_key) => ({
      organization_id: organizationId,
      source_id: sourceId,
      agent_key,
    })),
  );
}

async function agentsForSources(
  organizationId: string,
  sourceIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (sourceIds.length === 0) return map;
  const rows = await db
    .select({
      sourceId: knowledgeSourceAgents.source_id,
      agentKey: knowledgeSourceAgents.agent_key,
    })
    .from(knowledgeSourceAgents)
    .where(
      and(
        eq(knowledgeSourceAgents.organization_id, organizationId),
        inArray(knowledgeSourceAgents.source_id, sourceIds),
      ),
    );
  for (const r of rows) {
    const list = map.get(r.sourceId) ?? [];
    list.push(r.agentKey);
    map.set(r.sourceId, list);
  }
  return map;
}

export async function refreshSourceDocumentCount(
  organizationId: string,
  sourceId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, organizationId),
        eq(knowledgeDocuments.source_id, sourceId),
      ),
    );
  const n = Number(row?.n ?? 0);
  return n;
}

/** Ensure organization_integrations row exists; return its id. */
export async function ensureOrganizationIntegrationRow(input: {
  organizationId: string;
  catalogIntegrationId: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}): Promise<string> {
  const [existing] = await db
    .select({
      id: organizationIntegrations.id,
      config: organizationIntegrations.config,
    })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, input.organizationId),
        eq(organizationIntegrations.integration_id, input.catalogIntegrationId),
      ),
    )
    .limit(1);

  if (existing) {
    if (input.config || input.enabled !== undefined) {
      await db
        .update(organizationIntegrations)
        .set({
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.config
            ? {
                config: {
                  ...((existing.config as Record<string, unknown>) ?? {}),
                  ...input.config,
                },
              }
            : {}),
          updated_at: new Date(),
        })
        .where(eq(organizationIntegrations.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(organizationIntegrations)
    .values({
      organization_id: input.organizationId,
      integration_id: input.catalogIntegrationId,
      enabled: input.enabled ?? true,
      config: input.config ?? {},
    })
    .returning({ id: organizationIntegrations.id });
  return created!.id;
}

export async function listKnowledgeSources(
  organizationId: string,
): Promise<KnowledgeSourceRecord[]> {
  const rows = await db
    .select({
      source: knowledgeSources,
      sourceType: organizationIntegrations.integration_id,
    })
    .from(knowledgeSources)
    .innerJoin(
      organizationIntegrations,
      eq(
        organizationIntegrations.id,
        knowledgeSources.organization_integration_id,
      ),
    )
    .where(eq(knowledgeSources.organization_id, organizationId))
    .orderBy(desc(knowledgeSources.created_at));
  const agents = await agentsForSources(
    organizationId,
    rows.map((r) => r.source.id),
  );
  const urls = await websiteUrlsForIntegrations(
    organizationId,
    rows.map((r) => r.source.organization_integration_id),
  );
  const counts = await db
    .select({
      sourceId: knowledgeDocuments.source_id,
      n: count(),
    })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.organization_id, organizationId))
    .groupBy(knowledgeDocuments.source_id);
  const countsBySource = new Map(
    counts.map((row) => [row.sourceId, Number(row.n)]),
  );
  return rows.map((r) =>
    mapSource(
      r.source,
      r.sourceType,
      countsBySource.get(r.source.id) ?? 0,
      agents.get(r.source.id) ?? [],
      urls.get(r.source.organization_integration_id) ?? null,
    ),
  );
}

export async function getKnowledgeSource(
  organizationId: string,
  sourceId: string,
): Promise<KnowledgeSourceRecord | null> {
  const [row] = await db
    .select({
      source: knowledgeSources,
      sourceType: organizationIntegrations.integration_id,
    })
    .from(knowledgeSources)
    .innerJoin(
      organizationIntegrations,
      eq(
        organizationIntegrations.id,
        knowledgeSources.organization_integration_id,
      ),
    )
    .where(
      and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.organization_id, organizationId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const agents = await agentsForSources(organizationId, [row.source.id]);
  const urls = await websiteUrlsForIntegrations(organizationId, [
    row.source.organization_integration_id,
  ]);
  const documentCount = await refreshSourceDocumentCount(
    organizationId,
    row.source.id,
  );
  return mapSource(
    row.source,
    row.sourceType,
    documentCount,
    agents.get(row.source.id) ?? [],
    urls.get(row.source.organization_integration_id) ?? null,
  );
}

/**
 * Create or reuse a website knowledge source.
 * URL is stored on organization_integrations.config.
 */
export async function createWebsiteSource(
  input: CreateWebsiteSourceInput,
): Promise<KnowledgeSourceRecord> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!org) throw new Error("Organization not found");

  const websiteUrl = assertPublicHttpUrl(input.url);
  const organizationIntegrationId = await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "website",
    enabled: true,
    config: { url: websiteUrl, accountLabel: websiteUrl },
  });

  const [existing] = await db
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.organization_id, input.organizationId),
        eq(
          knowledgeSources.organization_integration_id,
          organizationIntegrationId,
        ),
      ),
    )
    .limit(1);

  if (existing) {
    return (await getKnowledgeSource(input.organizationId, existing.id))!;
  }

  const [row] = await db
    .insert(knowledgeSources)
    .values({
      organization_id: input.organizationId,
      organization_integration_id: organizationIntegrationId,
    })
    .returning();

  const agentIds =
    input.agentIds && input.agentIds.length > 0
      ? input.agentIds
      : defaultKnowledgeAgentKeys();
  await setSourceAgents(input.organizationId, row!.id, agentIds);
  return (await getKnowledgeSource(input.organizationId, row!.id))!;
}

/** Create or reuse the single source for an organization_integrations row. */
export async function createIntegrationSource(
  input: CreateIntegrationSourceInput,
): Promise<KnowledgeSourceRecord> {
  const [oi] = await db
    .select()
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.id, input.organizationIntegrationId),
        eq(organizationIntegrations.organization_id, input.organizationId),
      ),
    )
    .limit(1);
  if (!oi) throw new Error("Organization integration not found");

  const [existing] = await db
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.organization_id, input.organizationId),
        eq(
          knowledgeSources.organization_integration_id,
          input.organizationIntegrationId,
        ),
      ),
    )
    .limit(1);

  if (existing) {
    return (await getKnowledgeSource(input.organizationId, existing.id))!;
  }

  const [row] = await db
    .insert(knowledgeSources)
    .values({
      organization_id: input.organizationId,
      organization_integration_id: input.organizationIntegrationId,
    })
    .returning();

  const agentIds =
    input.agentIds && input.agentIds.length > 0
      ? input.agentIds
      : defaultKnowledgeAgentKeys();
  await setSourceAgents(input.organizationId, row!.id, agentIds);
  return (await getKnowledgeSource(input.organizationId, row!.id))!;
}

export async function updateKnowledgeSource(
  input: UpdateKnowledgeSourceInput,
): Promise<KnowledgeSourceRecord> {
  const existing = await getKnowledgeSource(
    input.organizationId,
    input.sourceId,
  );
  if (!existing) throw new Error("Knowledge source not found");

  await db
    .update(knowledgeSources)
    .set({
      ...(input.lastSyncedAt !== undefined
        ? { last_synced_at: input.lastSyncedAt }
        : {}),
    })
    .where(
      and(
        eq(knowledgeSources.id, input.sourceId),
        eq(knowledgeSources.organization_id, input.organizationId),
      ),
    );

  if (input.websiteUrl !== undefined) {
    const url = assertPublicHttpUrl(input.websiteUrl);
    await ensureOrganizationIntegrationRow({
      organizationId: input.organizationId,
      catalogIntegrationId: existing.sourceType,
      config: { url, accountLabel: url },
    });
  }

  return (await getKnowledgeSource(input.organizationId, input.sourceId))!;
}

export async function deleteKnowledgeSource(
  organizationId: string,
  sourceId: string,
): Promise<void> {
  const existing = await getKnowledgeSource(organizationId, sourceId);
  if (!existing) throw new Error("Knowledge source not found");

  // Documents (and chunks) cascade via knowledge_documents.source_id FK.
  await db
    .delete(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.organization_id, organizationId),
      ),
    );
}

/** Remove one document instance under a source. */
export async function deleteKnowledgeDocument(
  organizationId: string,
  documentId: string,
): Promise<{ sourceId: string }> {
  const [doc] = await db
    .select({
      id: knowledgeDocuments.id,
      sourceId: knowledgeDocuments.source_id,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.organization_id, organizationId),
      ),
    )
    .limit(1);
  if (!doc) throw new Error("Knowledge document not found");

  await db
    .delete(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.organization_id, organizationId),
      ),
    );

  await refreshSourceDocumentCount(organizationId, doc.sourceId);

  return { sourceId: doc.sourceId };
}

/** Delete all sources/docs/chunks for an org integration row. */
export async function purgeKnowledgeForOrganizationIntegration(
  organizationId: string,
  organizationIntegrationId: string,
): Promise<number> {
  const sources = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.organization_id, organizationId),
        eq(
          knowledgeSources.organization_integration_id,
          organizationIntegrationId,
        ),
      ),
    );

  let deletedDocuments = 0;
  for (const s of sources) {
    const [counted] = await db
      .select({ n: count() })
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.organization_id, organizationId),
          eq(knowledgeDocuments.source_id, s.id),
        ),
      );
    deletedDocuments += Number(counted?.n ?? 0);
    await deleteKnowledgeSource(organizationId, s.id);
  }
  return deletedDocuments;
}

/** Resolve catalog id → org integration row, then purge its knowledge. */
export async function purgeKnowledgeForCatalogIntegration(
  organizationId: string,
  catalogIntegrationId: string,
): Promise<number> {
  const [oi] = await db
    .select({ id: organizationIntegrations.id })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, organizationId),
        eq(organizationIntegrations.integration_id, catalogIntegrationId),
      ),
    )
    .limit(1);
  if (!oi) return 0;
  return await purgeKnowledgeForOrganizationIntegration(organizationId, oi.id);
}

export async function syncKnowledgeSource(
  organizationId: string,
  sourceId: string,
): Promise<KnowledgeSourceRecord> {
  const existing = await getKnowledgeSource(organizationId, sourceId);
  if (!existing) throw new Error("Knowledge source not found");

  const [oi] = await db
    .select({ enabled: organizationIntegrations.enabled })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.id, existing.organizationIntegrationId),
        eq(organizationIntegrations.organization_id, organizationId),
      ),
    )
    .limit(1);
  if (!oi?.enabled) {
    throw new Error("Enable this integration before syncing.");
  }

  if (existing.sourceType === "website" && existing.websiteUrl) {
    const { connectAndSyncWebsite } = await import("./synced-integrations");
    await connectAndSyncWebsite({
      organizationId,
      url: existing.websiteUrl,
    });
    return (await getKnowledgeSource(organizationId, sourceId))!;
  }

  throw new Error(
    "Re-sync this connector from Integrations (upload or refresh).",
  );
}

export async function assertSourceBelongsToOrg(
  organizationId: string,
  sourceId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.organization_id, organizationId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Catalog integration id for a source. */
export async function catalogIntegrationIdForSource(
  organizationId: string,
  sourceId: string,
): Promise<string | null> {
  const source = await getKnowledgeSource(organizationId, sourceId);
  return source?.sourceType ?? null;
}

export async function listSourcesForCatalogIntegration(
  organizationId: string,
  catalogIntegrationId: string,
): Promise<KnowledgeSourceRecord[]> {
  const all = await listKnowledgeSources(organizationId);
  return all.filter((s) => s.sourceType === catalogIntegrationId);
}
