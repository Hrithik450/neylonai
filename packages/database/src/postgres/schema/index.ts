import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizationParticipants } from "./participants";
import { threads } from "./threads";
import {
  organizations,
  organizationAccounts,
  organizationSettings,
  widgetConfigs,
} from "./organizations";
import {
  knowledgeDocuments,
  knowledgeChunks,
  knowledgeSources,
  knowledgeSourceAgents,
} from "./knowledge";
import {
  websiteCrawlJobs,
  websiteCrawlPages,
  websiteCrawlBudgetMonths,
} from "./crawls";
import { organizationAgents } from "./agents";
import {
  organizationIntegrations,
  organizationIntegrationSecrets,
} from "./integrations";
import {
  subscriptions,
  apiKeys,
  usageEvents,
  productUsageEvents,
  billingEvents,
  usageRequestRollups,
  creditLedger,
  usageClassPeriodCounters,
  usageRequestReservations,
} from "./billing";

export { users } from "./users";
export { organizationParticipants } from "./participants";
export {
  threads,
  threadMessages,
  threadEscalations,
  messageFeedback,
  CONVERSATION_STATUSES,
  threadRelations,
  threadMessageRelations,
  threadEscalationRelations,
} from "./threads";
export type { ConversationStatus } from "./threads";
export {
  organizations,
  organizationAccounts,
  organizationSettings,
  widgetConfigs,
  organizationFonts,
  organizationLogos,
} from "./organizations";
export type { OrganizationPrivacyPrefs } from "./organizations";
export {
  knowledgeDocuments,
  knowledgeChunks,
  knowledgeSources,
  knowledgeSourceAgents,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  toHalfvecLiteral,
} from "./knowledge";
export {
  websiteCrawlJobs,
  websiteCrawlPages,
  websiteCrawlBudgetMonths,
  WEBSITE_CRAWL_JOB_STATUSES,
  WEBSITE_CRAWL_JOB_MODES,
  WEBSITE_CRAWL_PAGE_STATUSES,
} from "./crawls";
export type {
  WebsiteCrawlJobStatus,
  WebsiteCrawlJobMode,
  WebsiteCrawlPageStatus,
} from "./crawls";
export {
  organizationAgents,
} from "./agents";
export {
  organizationIntegrations,
  organizationIntegrationSecrets,
} from "./integrations";
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
} from "./billing";
export {
  KNOWLEDGE_GAP_TYPES,
  PROACTIVE_TRIGGER_TYPES,
  PROACTIVE_TRIGGER_EVENT_TYPES,
} from "./engagement";
export type {
  KnowledgeGapType,
  ProactiveTriggerType,
  ProactiveTriggerEventType,
} from "./engagement";
export { visitorSuggestionState } from "./visitor-suggestions";

export const userRelations = relations(users, ({ many }) => ({
  organizationAccounts: many(organizationAccounts),
}));

export const organizationParticipantRelations = relations(
  organizationParticipants,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationParticipants.organization_id],
      references: [organizations.id],
    }),
    threads: many(threads),
  }),
);

export const organizationRelations = relations(organizations, ({ many, one }) => ({
  knowledgeSources: many(knowledgeSources),
  accounts: many(organizationAccounts),
  participants: many(organizationParticipants),
  threads: many(threads),
  subscriptions: many(subscriptions),
  apiKeys: many(apiKeys),
  widgetConfig: one(widgetConfigs, {
    fields: [organizations.id],
    references: [widgetConfigs.organization_id],
  }),
  usageEvents: many(usageEvents),
  organizationAgents: many(organizationAgents),
  integrations: many(organizationIntegrations),
  billingEvents: many(billingEvents),
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organization_id],
  }),
  websiteCrawlJobs: many(websiteCrawlJobs),
}));

export const widgetConfigRelations = relations(widgetConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [widgetConfigs.organization_id],
    references: [organizations.id],
  }),
}));

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSettings.organization_id],
      references: [organizations.id],
    }),
  }),
);

export const organizationAccountRelations = relations(
  organizationAccounts,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationAccounts.organization_id],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationAccounts.user_id],
      references: [users.id],
    }),
  }),
);

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organization_id],
    references: [organizations.id],
  }),
}));

export const apiKeyRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organization_id],
    references: [organizations.id],
  }),
}));

export const knowledgeSourceRelations = relations(
  knowledgeSources,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [knowledgeSources.organization_id],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [knowledgeSources.organization_integration_id],
      references: [organizationIntegrations.id],
    }),
    agents: many(knowledgeSourceAgents),
    documents: many(knowledgeDocuments),
  }),
);

export const knowledgeSourceAgentRelations = relations(
  knowledgeSourceAgents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [knowledgeSourceAgents.organization_id],
      references: [organizations.id],
    }),
    source: one(knowledgeSources, {
      fields: [knowledgeSourceAgents.source_id],
      references: [knowledgeSources.id],
    }),
  }),
);

export const knowledgeDocumentRelations = relations(
  knowledgeDocuments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [knowledgeDocuments.organization_id],
      references: [organizations.id],
    }),
    source: one(knowledgeSources, {
      fields: [knowledgeDocuments.source_id],
      references: [knowledgeSources.id],
    }),
    chunks: many(knowledgeChunks),
  }),
);

export const knowledgeChunkRelations = relations(knowledgeChunks, ({ one }) => ({
  organization: one(organizations, {
    fields: [knowledgeChunks.organization_id],
    references: [organizations.id],
  }),
  document: one(knowledgeDocuments, {
    fields: [knowledgeChunks.document_id],
    references: [knowledgeDocuments.id],
  }),
}));

export const organizationIntegrationRelations = relations(
  organizationIntegrations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationIntegrations.organization_id],
      references: [organizations.id],
    }),
    secrets: many(organizationIntegrationSecrets),
  }),
);

export const organizationIntegrationSecretRelations = relations(
  organizationIntegrationSecrets,
  ({ one }) => ({
    integration: one(organizationIntegrations, {
      fields: [organizationIntegrationSecrets.organization_integration_id],
      references: [organizationIntegrations.id],
    }),
  }),
);

export const organizationAgentRelations = relations(
  organizationAgents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationAgents.organization_id],
      references: [organizations.id],
    }),
  }),
);

export const websiteCrawlJobRelations = relations(
  websiteCrawlJobs,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [websiteCrawlJobs.organization_id],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [websiteCrawlJobs.organization_integration_id],
      references: [organizationIntegrations.id],
    }),
    source: one(knowledgeSources, {
      fields: [websiteCrawlJobs.knowledge_source_id],
      references: [knowledgeSources.id],
    }),
    pages: many(websiteCrawlPages),
  }),
);

export const websiteCrawlPageRelations = relations(
  websiteCrawlPages,
  ({ one }) => ({
    job: one(websiteCrawlJobs, {
      fields: [websiteCrawlPages.job_id],
      references: [websiteCrawlJobs.id],
    }),
    organization: one(organizations, {
      fields: [websiteCrawlPages.organization_id],
      references: [organizations.id],
    }),
  }),
);

export const websiteCrawlBudgetMonthRelations = relations(
  websiteCrawlBudgetMonths,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [websiteCrawlBudgetMonths.organization_id],
      references: [organizations.id],
    }),
  }),
);
