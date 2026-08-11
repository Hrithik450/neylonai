/**
 * Knowledge sources group documents under an org integration.
 * Catalog types (website, pdf, …) live in @neylonai/integrations.
 * Credentials / URLs / enabled live on organization_integrations.
 */

export const DEFAULT_CHATBOT_AGENT_ID = "neylonai-chatbot";

export type KnowledgeSourceRecord = {
  id: string;
  organizationId: string;
  /** Denormalized catalog type from organization_integrations.integration_type */
  sourceType: string;
  /** FK → organization_integrations.id */
  organizationIntegrationId: string;
  /** Convenience from org integration config (e.g. website url). */
  websiteUrl: string | null;
  documentCount: number;
  lastSyncedAt: string | null;
  agentIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreateWebsiteSourceInput = {
  organizationId: string;
  url: string;
  agentIds?: string[];
};

export type CreateIntegrationSourceInput = {
  organizationId: string;
  /** organization_integrations.id */
  organizationIntegrationId: string;
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
