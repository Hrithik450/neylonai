/**
 * @neylonai/integrations
 *
 * - Per-integration folders (website, pdf, slack, ...) own metadata + logic
 * - internal/ shared platform tools (scrape, gemini, web-search provider, notifications, crm adapters)
 * - catalog/ customer-facing integrations (including optional Web Search)
 */

export { createRegistry } from "./internal/registry";

export type { WebSearchProvider } from "./internal/web-search";
export { webSearchProviders } from "./internal/web-search";

export type {
  NotificationProvider,
  NotificationPayload,
} from "./internal/notifications";
export { notificationProviders } from "./internal/notifications";

export {
  GoogleApiKeyPool,
  getGoogleApiKeyPool,
  getGoogleApiKey,
  resetGoogleApiKeyPool,
  loadGoogleApiKeysFromEnv,
  isGoogleRateLimitError,
  withGoogleApiRetry,
} from "./internal/gemini";

export {
  trackEvently,
  trackEventlySafe,
  type NeylonAnalyticsEvent,
  type TrackEventInput,
} from "./evently";

export {
  registerCrmAdapter,
  getCrmAdapter,
  listCrmAdapters,
  type CrmAdapter,
  type CrmLeadPayload,
  type CrmLeadSyncResult,
} from "./internal/crm";

export {
  connectedAccountLabel,
  getImportIngestKind,
  getIntegrationManifest,
  getIntegrationModule,
  INTEGRATION_DATA_MODE_LABELS,
  INTEGRATION_MANIFESTS,
  INTEGRATION_MODULES,
  integrationLogoLetters,
  isConnectIntegration,
  isImportIntegration,
  isSyncIntegration,
  lastSyncLabel,
  listBillingCatalogEntries,
  listImportIntegrationIds,
  listIntegrationManifests,
  listIntegrationModules,
  redactIntegrationConfig,
  configHasLegacyCredentials,
  resolveIntegrationUiState,
  toBillingCatalogEntry,
  type IntegrationConnectionSnapshot,
  type IntegrationDataMode,
  type IntegrationIngestKind,
  type IntegrationManifest,
  type IntegrationModule,
  type IntegrationPlanBadge,
  type IntegrationUiState,
} from "./catalog";

export {
  scrapePublicUrl,
  fetchPublicHtml,
  assertPublicHttpUrl,
  extractSameOriginLinks,
  extractMarkdownLinks,
  looksLikeDynamicCatalogUrl,
  type ScrapeResult,
  type ScrapeProvider,
} from "./internal/scrape";

export {
  fetchWebsiteForImport,
  websiteIntegration,
  type WebsiteFetchResult,
} from "./website";

export {
  extractPdfText,
  pdfIntegration,
  PDF_MAX_EXTRACT_CHARS,
} from "./pdf";

export {
  databaseIntegration,
  connectPostgresForImport,
  assertPostgresConnectionUrl,
  assertSafePostgresConnectionUrl,
  POSTGRES_READONLY_SETUP_SQL,
  type DatabaseConnectResult,
} from "./database";

export { POSTGRES_READONLY_SETUP_SQL as DATABASE_SETUP_SQL } from "./database/constants";

export {
  DATABASE_CLOUD_PROVIDERS,
  DATABASE_PRIVATE_PROVIDERS,
  SUPABASE_CONNECTION_URL_EXAMPLES,
  SUPABASE_READONLY_ROLE,
  SUPABASE_READONLY_SETUP_SQL,
  SUPABASE_SETUP_SKILL_NAME,
  SUPABASE_SETUP_SKILL_PATH,
  type DatabaseCloudProviderId,
  type DatabaseDeploymentKind,
  type DatabasePrivateProviderId,
  type DatabaseProviderId,
  type DatabaseProviderOption,
  type DatabaseProviderStatus,
  type SupabaseSetupMethod,
} from "./database/setup";

export {
  calcomIntegration,
  calcomManifest,
} from "./calcom";

