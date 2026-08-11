/**
 * Synced knowledge integrations: Website / PDF → sources + documents + ingest.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
  organizationIntegrations,
} from "@neylonai/database";
import { fetchWebsiteForImport } from "@neylonai/integrations/website";
import { connectPostgresForImport } from "@neylonai/integrations/database";
import {
  DATABASE_CONNECTION_URL_SECRET_KEY,
  putSecret,
  stripCredentialKeysFromConfig,
} from "../integrations/secrets";
import { ingestDocumentsForSource } from "./ingest";
import {
  createIntegrationSource,
  createWebsiteSource,
  ensureOrganizationIntegrationRow,
  getKnowledgeSource,
  listSourcesForCatalogIntegration,
  refreshSourceDocumentCount,
  updateKnowledgeSource,
} from "./service";
import { DEFAULT_CHATBOT_AGENT_ID } from "./types";

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
}): Promise<{
  knowledgeSourceId: string;
  title: string;
  chunkCount: number;
  pagesScraped: number;
  storedText: string;
}> {
  let url = input.url?.trim() ?? "";

  const existingSources = await listSourcesForCatalogIntegration(
    input.organizationId,
    "website",
  );
  const primary = existingSources[0] ?? null;
  if (!url && primary?.websiteUrl) url = primary.websiteUrl;
  if (!url) throw new Error("A public URL is required.");

  const scraped = await fetchWebsiteForImport(url);

  // COGS: Firecrawl / Jina page credits (static = 0).
  if (scraped.creditsUsed > 0) {
    const toolId =
      scraped.provider === "firecrawl"
        ? "firecrawl.scrape"
        : scraped.provider === "jina"
          ? "jina.reader"
          : null;
    if (toolId) {
      const { recordToolUsageSafe } = await import("../billing/usage");
      recordToolUsageSafe({
        organizationId: input.organizationId,
        requestId: `website-sync:${input.organizationId}:${Date.now()}`,
        toolId,
        operation: "page",
        quantity: scraped.creditsUsed,
        metadata: {
          url: scraped.finalUrl,
          pagesScraped: scraped.pagesScraped,
          provider: scraped.provider,
        },
      });
    }
  }

  await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "website",
    enabled: true,
    config: {
      url: scraped.finalUrl,
      lastSyncAt: new Date().toISOString(),
      accountLabel: scraped.finalUrl,
      scrapeProvider: scraped.provider,
      pagesScraped: scraped.pagesScraped,
    },
  });

  const source = await createWebsiteSource({
    organizationId: input.organizationId,
    url: scraped.finalUrl,
    agentIds: [DEFAULT_CHATBOT_AGENT_ID],
  });

  await updateKnowledgeSource({
    organizationId: input.organizationId,
    sourceId: source.id,
    websiteUrl: scraped.finalUrl,
  });

  const { chunkCount, documentCount } = await ingestDocumentsForSource({
    organizationId: input.organizationId,
    sourceId: source.id,
    catalogIntegrationId: "website",
    documents: [
      {
        externalDocId: `website:${Buffer.from(scraped.finalUrl).toString("base64url").slice(0, 80)}`,
        name: scraped.title,
        text: scraped.text,
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
    catalogIntegrationId: "website",
    enabled: true,
    config: {
      url: scraped.finalUrl,
      knowledgeSourceId: source.id,
      lastSyncAt: new Date().toISOString(),
      chunkCount,
      accountLabel: scraped.finalUrl,
    },
  });

  return {
    knowledgeSourceId: source.id,
    title: scraped.title,
    chunkCount,
    pagesScraped: scraped.pagesScraped ?? 1,
    storedText: scraped.text,
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

  // Drop any legacy plaintext connectionUrl left in config.
  const [row] = await db
    .select({ config: organizationIntegrations.config })
    .from(organizationIntegrations)
    .where(eq(organizationIntegrations.id, organizationIntegrationId))
    .limit(1);
  if (row?.config && "connectionUrl" in (row.config as object)) {
    await db
      .update(organizationIntegrations)
      .set({
        config: stripCredentialKeysFromConfig(
          (row.config as Record<string, unknown>) ?? {},
          [DATABASE_CONNECTION_URL_SECRET_KEY],
        ),
        updated_at: new Date(),
      })
      .where(eq(organizationIntegrations.id, organizationIntegrationId));
  }

  const source = await createIntegrationSource({
    organizationId: input.organizationId,
    organizationIntegrationId,
    agentIds: [DEFAULT_CHATBOT_AGENT_ID],
  });

  const { chunkCount, documentCount } = await ingestDocumentsForSource({
    organizationId: input.organizationId,
    sourceId: source.id,
    catalogIntegrationId: "database",
    documents: [
      {
        externalDocId: `database:${organizationIntegrationId}:schema`,
        name: `Postgres schema (${connected.host}/${connected.database})`,
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

export async function ingestPdfTextForOrg(input: {
  organizationId: string;
  sourceId: string;
  fileName: string;
  text: string;
  storageKey?: string | null;
}): Promise<{ chunkCount: number }> {
  const source = await getKnowledgeSource(
    input.organizationId,
    input.sourceId,
  );
  if (!source) throw new Error("Knowledge source not found");

  const { chunkCount } = await ingestDocumentsForSource({
    organizationId: input.organizationId,
    sourceId: input.sourceId,
    catalogIntegrationId: "pdf",
    replaceAll: false,
    documents: [
      {
        externalDocId: `pdf:${input.sourceId}:${input.fileName}`.slice(0, 255),
        name: input.fileName,
        text: input.text,
        storageKey: input.storageKey ?? null,
      },
    ],
  });

  const documentCount = await refreshSourceDocumentCount(
    input.organizationId,
    input.sourceId,
  );

  await updateKnowledgeSource({
    organizationId: input.organizationId,
    sourceId: input.sourceId,
    documentCount,
    lastSyncedAt: new Date(),
  });

  await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "pdf",
    enabled: true,
    config: {
      knowledgeSourceId: input.sourceId,
      fileName: input.fileName,
      lastSyncAt: new Date().toISOString(),
      chunkCount,
      accountLabel: input.fileName,
    },
  });

  return { chunkCount };
}

/** Create PDF source under the org's pdf organization_integrations row. */
export async function ensurePdfIntegrationSource(input: {
  organizationId: string;
}): Promise<{ sourceId: string; organizationIntegrationId: string }> {
  const organizationIntegrationId = await ensureOrganizationIntegrationRow({
    organizationId: input.organizationId,
    catalogIntegrationId: "pdf",
    enabled: true,
  });
  const source = await createIntegrationSource({
    organizationId: input.organizationId,
    organizationIntegrationId,
    agentIds: [DEFAULT_CHATBOT_AGENT_ID],
  });
  return { sourceId: source.id, organizationIntegrationId };
}

export async function disconnectSyncedIntegration(input: {
  organizationId: string;
  integrationId: SyncedKnowledgeIntegrationId;
}): Promise<{ storageKeys: string[] }> {
  const { deleteSecretsForOrgCatalogIntegration } = await import(
    "../integrations/secrets"
  );
  await deleteSecretsForOrgCatalogIntegration({
    organizationId: input.organizationId,
    integrationType: input.integrationId,
  });

  const { purgeKnowledgeForCatalogIntegration } = await import("./service");
  const { storageKeys } = await purgeKnowledgeForCatalogIntegration(
    input.organizationId,
    input.integrationId,
  );

  await db
    .update(organizationIntegrations)
    .set({
      enabled: false,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(organizationIntegrations.organization_id, input.organizationId),
        eq(organizationIntegrations.integration_type, input.integrationId),
      ),
    );

  return { storageKeys };
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
      name: knowledgeDocuments.name,
      rawContent: knowledgeDocuments.raw_content,
      storageKey: knowledgeDocuments.storage_key,
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
    return {
      id: s.id,
      name:
        s.sourceType === "website"
          ? s.websiteUrl || "Website"
          : first?.name || "Documents",
      type: s.sourceType,
      originUri: s.websiteUrl,
      hasStoredFile:
        Boolean(first?.storageKey) ||
        (typeof first?.rawContent === "string" && first.rawContent.length > 0) ||
        childDocs.length > 0,
      documentCount: s.documentCount || childDocs.length,
      updatedAt: s.updatedAt ?? new Date().toISOString(),
    };
  });

  // For PDF, expose each document as a navigable row in sources list
  if (integrationId === "pdf" && docs.length > 0) {
    const perDoc: SyncedKnowledgeSourceRow[] = docs.map((d) => {
      return {
        id: d.id,
        name: d.name || "document.pdf",
        type: "pdf",
        originUri: null,
        hasStoredFile: Boolean(d.storageKey),
        documentCount: 1,
        updatedAt: d.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
    return {
      knowledgeSourceId: primary.id,
      sourceCount: perDoc.length,
      documentCount,
      chunkCount,
      downloadable: perDoc.some((s) => s.hasStoredFile),
      preview: text ? text.slice(0, 500) : null,
      url: null,
      fileName: primaryDoc?.name ?? null,
      sources: perDoc,
    };
  }

  return {
    knowledgeSourceId: primary.id,
    sourceCount: matched.length,
    documentCount,
    chunkCount,
    downloadable: sources.some((s) => s.hasStoredFile),
    preview: text ? text.slice(0, 500) : null,
    url: primary.websiteUrl,
    fileName: primaryDoc?.name ?? null,
    sources,
  };
}

export { refreshSourceDocumentCount };
