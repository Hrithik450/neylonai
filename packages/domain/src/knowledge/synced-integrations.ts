/**
 * Synced knowledge integrations: Website / Database → sources + documents.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
  organizationIntegrations,
} from "@neylonai/database";
import { connectPostgresForImport } from "@neylonai/integrations/database";
import {
  DATABASE_CONNECTION_URL_SECRET_KEY,
  putSecret,
} from "../integrations/secrets";
import { ingestDocumentsForSource } from "./ingest";
import {
  createIntegrationSource,
  ensureOrganizationIntegrationRow,
  getKnowledgeSource,
  listSourcesForCatalogIntegration,
  refreshSourceDocumentCount,
  updateKnowledgeSource,
} from "./service";
import { WEBSITE_REIMPORT_COOLDOWN_MS } from "./crawl/helpers";
import { MAIN_AGENT_KEY } from "../agents/org-agents.types";

export type SyncedKnowledgeIntegrationId = string;

export type SyncedKnowledgeSourceRow = {
  id: string;
  name: string;
  type: string;
  originUri: string | null;
  hasStoredFile: boolean;
  documentCount: number;
  updatedAt: string;
};

export type SyncedKnowledgeSnapshot = {
  knowledgeSourceId: string | null;
  sourceCount: number;
  documentCount: number;
  chunkCount: number;
  downloadable: boolean;
  preview: string | null;
  url: string | null;
  fileName: string | null;
  sources: SyncedKnowledgeSourceRow[];
};

async function countDocsAndChunks(
  organizationId: string,
  sourceIds: string[],
): Promise<{ documentCount: number; chunkCount: number }> {
  if (sourceIds.length === 0) {
    return { documentCount: 0, chunkCount: 0 };
  }
  const [docs] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, organizationId),
        inArray(knowledgeDocuments.source_id, sourceIds),
      ),
    );
  const docIds = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, organizationId),
        inArray(knowledgeDocuments.source_id, sourceIds),
      ),
    );
  const ids = docIds.map((d) => d.id);
  if (ids.length === 0) {
    return { documentCount: Number(docs?.n ?? 0), chunkCount: 0 };
  }
  const [chunks] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.organization_id, organizationId),
        inArray(knowledgeChunks.document_id, ids),
      ),
    );
  return {
    documentCount: Number(docs?.n ?? 0),
    chunkCount: Number(chunks?.n ?? 0),
  };
}

export async function connectAndSyncWebsite(input: {
  organizationId: string;
  url?: string;
  maxPages?: number;
  plan?: string;
}): Promise<{
  knowledgeSourceId: string;
  jobId: string;
  title: string;
  chunkCount: number;
  pagesScraped: number;
  storedText: string;
  queued: true;
}> {
  const { getSubscriptionForOrg } = await import("../billing/entitlements");
  const { startWebsiteCrawl } = await import("./crawl/service");
  const subscription = await getSubscriptionForOrg(input.organizationId);
  const job = await startWebsiteCrawl({
    organizationId: input.organizationId,
    plan: input.plan ?? subscription?.plan ?? "free",
    url: input.url,
    maxPages: input.maxPages,
  });
  return {
    knowledgeSourceId: job.knowledgeSourceId ?? job.id,
    jobId: job.id,
    title: job.seedUrl,
    chunkCount: 0,
    pagesScraped: 0,
    storedText: "",
    queued: true,
  };
}

export async function connectAndSyncDatabase(input: {
  organizationId: string;
  connectionUrl: string;
  /** Non-secret metadata for the integrations UI (e.g. supabase / cloud). */
  provider?: string;
  deployment?: string;
}): Promise<{
  knowledgeSourceId: string;
  tableCount: number;
  chunkCount: number;
  host: string;
}> {
  const connected = await connectPostgresForImport(input.connectionUrl);

  // Metadata only in config — connection URL goes to the encrypted vault.
  const organizationIntegrationId = await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "database",
    enabled: true,
    config: {
      host: connected.host,
      database: connected.database,
      tableCount: connected.tableCount,
      lastSyncAt: connected.connectedAt,
      accountLabel: `${connected.host}/${connected.database}`,
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.deployment ? { deployment: input.deployment } : {}),
    },
  });

  await putSecret({
    organizationId: input.organizationId,
    organizationIntegrationId,
    secretKey: DATABASE_CONNECTION_URL_SECRET_KEY,
    plaintext: input.connectionUrl.trim(),
  });

  const source = await createIntegrationSource({
    organizationId: input.organizationId,
    organizationIntegrationId,
    agentIds: [MAIN_AGENT_KEY],
  });

  const { chunkCount, documentCount } = await ingestDocumentsForSource({
    organizationId: input.organizationId,
    sourceId: source.id,
    catalogIntegrationId: "database",
    documents: [
      {
        externalDocId: `database:${organizationIntegrationId}:schema`,
        text: connected.schemaText,
      },
    ],
  });

  await updateKnowledgeSource({
    organizationId: input.organizationId,
    sourceId: source.id,
    documentCount,
    lastSyncedAt: new Date(),
  });

  await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "database",
    enabled: true,
    config: {
      knowledgeSourceId: source.id,
      lastSyncAt: new Date().toISOString(),
      chunkCount,
      tableCount: connected.tableCount,
      host: connected.host,
      database: connected.database,
      accountLabel: `${connected.host}/${connected.database}`,
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.deployment ? { deployment: input.deployment } : {}),
    },
  });

  return {
    knowledgeSourceId: source.id,
    tableCount: connected.tableCount,
    chunkCount,
    host: connected.host,
  };
}

export async function disconnectSyncedIntegration(input: {
  organizationId: string;
  integrationId: SyncedKnowledgeIntegrationId;
}): Promise<{
  deletedDocuments: number;
  reimportAvailableAt: string | null;
}> {
  const [integration] = await db
    .select({ config: organizationIntegrations.config })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, input.organizationId),
        eq(organizationIntegrations.integration_id, input.integrationId),
      ),
    )
    .limit(1);
  const reimportAvailableAt =
    input.integrationId === "website"
      ? new Date(Date.now() + WEBSITE_REIMPORT_COOLDOWN_MS).toISOString()
      : null;

  const { deleteSecretsForOrgCatalogIntegration } =
    await import("../integrations/secrets");
  await deleteSecretsForOrgCatalogIntegration({
    organizationId: input.organizationId,
    integrationType: input.integrationId,
  });

  const { purgeKnowledgeForCatalogIntegration } = await import("./service");
  const deletedDocuments = await purgeKnowledgeForCatalogIntegration(
    input.organizationId,
    input.integrationId,
  );

  if (input.integrationId === "website") {
    const { websiteCrawlJobs } = await import("@neylonai/database");
    await db
      .delete(websiteCrawlJobs)
      .where(eq(websiteCrawlJobs.organization_id, input.organizationId));
  }

  await db
    .update(organizationIntegrations)
    .set({
      enabled: false,
      config: {
        ...((integration?.config as Record<string, unknown> | null) ?? {}),
        ...(reimportAvailableAt ? { reimportAvailableAt } : {}),
      },
      updated_at: new Date(),
    })
    .where(
      and(
        eq(organizationIntegrations.organization_id, input.organizationId),
        eq(organizationIntegrations.integration_id, input.integrationId),
      ),
    );

  return { deletedDocuments, reimportAvailableAt };
}

export async function getSyncedKnowledgeSnapshot(
  organizationId: string,
  integrationId: SyncedKnowledgeIntegrationId,
): Promise<SyncedKnowledgeSnapshot | null> {
  const matched = await listSourcesForCatalogIntegration(
    organizationId,
    integrationId,
  );
  if (matched.length === 0) return null;

  const sourceIds = matched.map((s) => s.id);
  const { documentCount, chunkCount } = await countDocsAndChunks(
    organizationId,
    sourceIds,
  );

  const primary = matched[0]!;
  const docs = await db
    .select({
      id: knowledgeDocuments.id,
      canonicalPath: knowledgeDocuments.canonical_path,
      rawContent: knowledgeDocuments.raw_content,
      updatedAt: knowledgeDocuments.updated_at,
      sourceId: knowledgeDocuments.source_id,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, organizationId),
        inArray(knowledgeDocuments.source_id, sourceIds),
      ),
    );

  const primaryDoc = docs[0];
  const text =
    typeof primaryDoc?.rawContent === "string" && primaryDoc.rawContent.trim()
      ? primaryDoc.rawContent
      : null;

  const sources: SyncedKnowledgeSourceRow[] = matched.map((s) => {
    const childDocs = docs.filter((d) => d.sourceId === s.id);
    const first = childDocs[0];
    const hasText =
      (typeof first?.rawContent === "string" && first.rawContent.length > 0) ||
      childDocs.some(
        (d) => typeof d.rawContent === "string" && d.rawContent.length > 0,
      );
    return {
      id: s.id,
      name:
        s.sourceType === "website"
          ? s.websiteUrl || "Website"
          : s.sourceType === "database"
            ? "Database schema"
            : "Documents",
      type: s.sourceType,
      originUri: s.websiteUrl,
      hasStoredFile: hasText || childDocs.length > 0,
      documentCount: s.documentCount || childDocs.length,
      updatedAt: s.lastSyncedAt ?? s.createdAt ?? new Date().toISOString(),
    };
  });

  return {
    knowledgeSourceId: primary.id,
    sourceCount: matched.length,
    documentCount,
    chunkCount,
    downloadable: sources.some((s) => s.hasStoredFile),
    preview: text ? text.slice(0, 500) : null,
    url: primary.websiteUrl,
    fileName: primaryDoc?.canonicalPath
      ? `${primaryDoc.canonicalPath.replace(/[^\w.-]+/g, "_") || "document"}.txt`
      : null,
    sources,
  };
}

export { refreshSourceDocumentCount };
