export {
  ELIGIBLE_SUBSCRIPTION_STATUSES,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  DEFAULT_MONTHLY_REQUEST_LIMIT,
  hashApiKey,
  apiKeyPrefix,
  generateApiKey,
  extractApiKeyFromHeaders,
  isSubscriptionEligible,
  normalizeSubscriptionStatus,
  ApiAuthError,
  type ApiAuthFailureCode,
  type SubscriptionStatus,
  type EligibleSubscriptionStatus,
} from "./keys";

export {
  PLAN_CATALOG,
  AGENT_CATALOG,
  INTEGRATION_CATALOG,
  FEATURE_KEYS,
  normalizePlanId,
  getPlanEntitlements,
  planHasFeature,
  type PlanId,
  type PlanEntitlements,
  type FeatureKey,
} from "./plans";

export {
  authenticateApiKey,
  listApiKeysForOrg,
  createApiKeyForOrg,
  updateApiKeyOrigins,
  revokeApiKey,
  regenerateApiKey,
  getSubscriptionForOrg,
  ensureOrganizationWorkspace,
  getOrganizationForUser,
  listOrganizationsAdmin,
  type ApiKeyAuthContext,
  type AuthenticateApiKeyInput,
} from "./entitlements";

export {
  canUseFeature,
  canUseProactive,
  canUseAgent,
  canUseIntegration,
  canUseWebsite,
  canUseKnowledgeBase,
  canConsumeConversation,
  canConsumeProactive,
  assertCanConsumeConversation,
  assertCanUseProactive,
  assertCanUseAgent,
  assertCanUseIntegration,
  assertCanEnableIntegration,
  listOrgAgents,
  getOrgAgent,
  setOrgAgentEnabled,
  listOrgIntegrations,
  setOrgIntegration,
  countEnabledIntegrations,
  type EntitlementContext,
} from "./checks";

export {
  recordModelUsage,
  recordModelUsageSafe,
  recordToolUsage,
  recordToolUsageSafe,
  recordProductUsage,
  recordProductUsageSafe,
  extractTokenUsage,
  getOrgUsageSummary,
  listRecentUsage,
  getUsageTrendForOrg,
  getPlatformUsageSnapshot,
  countProductMetric,
  modelCostMicros,
  toolCostMicros,
  MODEL_PRICE_BOOK,
  TOOL_PRICE_BOOK,
  getModelPrice,
  type ProductMetric,
  type UsageAttribution,
  type RecordModelUsageInput,
  type RecordToolUsageInput,
  type RecordProductUsageInput,
  type UsageTrendPoint,
} from "./usage";

export {
  resolvePaymentProvider,
  applyProviderWebhookEvent,
  startCheckout,
  cancelSubscriptionServerSide,
  changePlanServerSide,
  listBillingEventsForOrg,
  createStripeProvider,
  createRazorpayProvider,
  type PaymentProvider,
  type PaymentProviderId,
  type ProviderWebhookEvent,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
} from "./payments";

export {
  getAdminPlatformMetrics,
  listSubscriptionsAdmin,
  listApiKeysAdmin,
} from "./admin-metrics";

export { getUnitEconomicsReport, STACK_CATALOG } from "./unit-economics";

export {
  resolveSiteWidgetApiKey,
  SITE_WIDGET_API_KEY_NAME,
} from "./site-api-key";

export {
  recommendUpgradePlan,
  buildFeatureUpgradePrompt,
  buildPlanBadgeUpgradePrompt,
  buildUsageUpgradePrompt,
  shouldShowUpgradeCta,
  formatPlanPrice,
  getPlanDisplay,
  lowestPlanForFeature,
  type UpgradeFeature,
  type UpgradePromptContent,
} from "./upgrade";
