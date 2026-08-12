// Postgres (Drizzle)
export { db } from "./postgres/client";
export * as schema from "./postgres/schema";
export {
  getDirectDatabaseUrl,
  getRuntimeDatabaseUrl,
  isTransactionPoolerUrl,
  sanitizeDatabaseUrl,
} from "./postgres/pool-config";

// Redis (cache-aside helpers)
export { redis } from "./redis/client";
export { cacheGet, cacheSet, cacheDel } from "./redis/cache";

// Knowledge retrieval (pgvector + FTS) — DB access stays here
export {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  toHalfvecLiteral,
  knowledgeChunks,
  knowledgeDocuments,
  organizations,
  searchKnowledgeByVector,
  searchKnowledgeByKeyword,
  resolveKnowledgeScope,
  resolveDevKnowledgeScope,
  listKnowledgeSuggestionSeeds,
  type KnowledgeSearchHit,
  type VectorSearchInput,
  type KeywordSearchHit,
  type KeywordSearchInput,
  type KnowledgeScope,
  type KnowledgeSuggestionSeed,
} from "./knowledge";
export {
  knowledgeSources,
  knowledgeSourceAgents,
} from "./postgres/schema/knowledge";
export {
  widgetConfigs,
  organizationFonts,
  organizationLogos,
  organizationMembers,
  organizationEngagementSettings,
  organizationWorkspaceSettings,
} from "./postgres/schema/organizations";
export type {
  WorkspaceNotificationPrefs,
  WorkspacePrivacyPrefs,
  WorkspaceSsoPrep,
} from "./postgres/schema/organizations";
export {
  subscriptions,
  apiKeys,
  usageEvents,
  usageEventsLegacy,
  productUsageEvents,
  billingEvents,
} from "./postgres/schema/billing";
export { organizationAgents } from "./postgres/schema/agents";
export {
  organizationIntegrations,
  organizationIntegrationSecrets,
} from "./postgres/schema/integrations";
export {
  conversationStates,
} from "./postgres/schema/tickets";
export { leads } from "./postgres/schema/leads";
export { threads, threadMessages } from "./postgres/schema/threads";
export { users } from "./postgres/schema/users";
export { visitors } from "./postgres/schema/visitors";
export {
  applyRetentionForAllOrganizations,
  applyRetentionForOrganization,
  type RetentionRunResult,
  type RetentionTableResult,
} from "./retention";
