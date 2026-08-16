/**
 * Knowledge sources group documents under an org integration.
 * Catalog integration types live in @neylonai/integrations.
 * Credentials / URLs / enabled live on organization_integrations.
 */

export type KnowledgeSourceRecord = {
  id: string;
  organizationId: string;
  /** Denormalized catalog type from organization_integrations.integration_id */
  sourceType: string;
  /** FK → organization_integrations.id */
  organizationIntegrationId: string;
  /** Convenience from org integration config (e.g. website url). */
  websiteUrl: string | null;
  documentCount: number;
  lastSyncedAt: string | null;
  /** Code-registry agent keys linked via knowledge_source_agents */
  agentIds: string[];
  createdAt: string | null;
};

export type CreateWebsiteSourceInput = {
  organizationId: string;
  url: string;
  /** Agent UUID; defaults to Main Agent */
  agentIds?: string[];
};

export type CreateIntegrationSourceInput = {
  organizationId: string;
  /** organization_integrations.id */
  organizationIntegrationId: string;
  /** Agent UUID; defaults to Main Agent */
  agentIds?: string[];
};

export type UpdateKnowledgeSourceInput = {
  organizationId: string;
  sourceId: string;
  /** When set, merges into organization_integrations.config.url for website. */
  websiteUrl?: string;
  documentCount?: number;
  lastSyncedAt?: Date | null;
};
