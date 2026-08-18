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
  knowledgePageSections,
  knowledgeDocuments,
  organizations,
  searchKnowledgeByVector,
  searchKnowledgeByKeyword,
  resolveKnowledgeScope,
  resolveDevKnowledgeScope,
  listKnowledgeSuggestionSeeds,
  findKnowledgePageSection,
  listExistingPageSections,
  listKnowledgePageSectionKeys,
  type KnowledgeSearchHit,
  type VectorSearchInput,
  type KeywordSearchHit,
  type KeywordSearchInput,
  type KnowledgeScope,
  type KnowledgeSuggestionSeed,
  type ExistingPageSection,
  type StoredPageSection,
  type PageSectionKeyManifest,
} from "./knowledge";
export {
  knowledgeSources,
  knowledgeSourceAgents,
} from "./postgres/schema/knowledge";
export {
  widgetConfigs,
  organizationFonts,
  organizationLogos,
  organizationAccounts,
  organizationSettings,
} from "./postgres/schema/organizations";
export type { OrganizationPrivacyPrefs } from "./postgres/schema/organizations";
export {
  subscriptions,
  apiKeys,
  usageEvents,
  productUsageEvents,
  billingEvents,
  usageRequestRollups,
  creditLedger,
  usageClassPeriodCounters,
  usageRequestReservations,
} from "./postgres/schema/billing";
export {
  organizationAgents,
} from "./postgres/schema/agents";
export {
  organizationIntegrations,
  organizationIntegrationSecrets,
} from "./postgres/schema/integrations";
export {
  websiteCrawlJobs,
  websiteCrawlPages,
  websiteCrawlBudgetMonths,
  WEBSITE_CRAWL_JOB_STATUSES,
  WEBSITE_CRAWL_JOB_MODES,
  WEBSITE_CRAWL_PAGE_STATUSES,
} from "./postgres/schema/crawls";
export type {
  WebsiteCrawlJobStatus,
  WebsiteCrawlJobMode,
  WebsiteCrawlPageStatus,
} from "./postgres/schema/crawls";
export {
  threads,
  threadMessages,
  threadEscalations,
  messageFeedback,
  CONVERSATION_STATUSES,
} from "./postgres/schema/threads";
export {
  KNOWLEDGE_GAP_TYPES,
  PROACTIVE_TRIGGER_TYPES,
  PROACTIVE_TRIGGER_EVENT_TYPES,
} from "./postgres/schema/engagement";
export type {
  KnowledgeGapType,
  ProactiveTriggerType,
  ProactiveTriggerEventType,
} from "./postgres/schema/engagement";
export { visitorSuggestionState } from "./postgres/schema/visitor-suggestions";
export {
  getVisitorSectionSuggestionState,
  syncVisitorSectionSuggestionPool,
  markVisitorSectionSuggestionShown,
  type VisitorSectionSuggestionState,
} from "./engagement";
export type { ConversationStatus } from "./postgres/schema/threads";
export { organizationParticipants } from "./postgres/schema/participants";
export { users } from "./postgres/schema/users";
export {
  applyRetentionForAllOrganizations,
  applyRetentionForOrganization,
  type RetentionRunResult,
  type RetentionTableResult,
} from "./retention";
