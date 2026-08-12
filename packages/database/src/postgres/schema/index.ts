import { relations } from "drizzle-orm";
import { users } from "./users";
import { visitors } from "./visitors";
import { threads } from "./threads";
import {
  organizations,
  organizationMembers,
  organizationWorkspaceSettings,
  organizationEngagementSettings,
  widgetConfigs,
} from "./organizations";
import {
  knowledgeDocuments,
  knowledgeChunks,
  knowledgeSources,
  knowledgeSourceAgents,
} from "./knowledge";
import { organizationAgents } from "./agents";
import {
  organizationIntegrations,
  organizationIntegrationSecrets,
} from "./integrations";
import {
  subscriptions,
  apiKeys,
  usageEvents,
  usageEventsLegacy,
  productUsageEvents,
  billingEvents,
} from "./billing";
import { conversationStates } from "./tickets";
import { leads } from "./leads";
import { threadMessages } from "./threads";

export { users } from "./users";
export { visitors } from "./visitors";
export {
  threads,
  threadMessages,
  threadRelations,
  threadMessageRelations,
} from "./threads";
export { leads } from "./leads";
export {
  organizations,
  organizationMembers,
  organizationWorkspaceSettings,
  organizationEngagementSettings,
  widgetConfigs,
  organizationFonts,
  organizationLogos,
} from "./organizations";
export type {
  WorkspaceNotificationPrefs,
  WorkspacePrivacyPrefs,
  WorkspaceSsoPrep,
} from "./organizations";
export {
  knowledgeDocuments,
  knowledgeChunks,
  knowledgeSources,
  knowledgeSourceAgents,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  toHalfvecLiteral,
} from "./knowledge";
export { organizationAgents } from "./agents";
export {
  organizationIntegrations,
  organizationIntegrationSecrets,
} from "./integrations";
export {
  subscriptions,
  apiKeys,
  usageEvents,
  usageEventsLegacy,
  productUsageEvents,
  billingEvents,
} from "./billing";
export { conversationStates } from "./tickets";

export const userRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
}));

export const visitorRelations = relations(visitors, ({ many }) => ({
  threads: many(threads),
}));

export const organizationRelations = relations(organizations, ({ many }) => ({
  knowledgeSources: many(knowledgeSources),
  members: many(organizationMembers),
  subscriptions: many(subscriptions),
  apiKeys: many(apiKeys),
  widgetConfigs: many(widgetConfigs),
  usageEvents: many(usageEvents),
  agents: many(organizationAgents),
  integrations: many(organizationIntegrations),
  integrationSecrets: many(organizationIntegrationSecrets),
  billingEvents: many(billingEvents),
  conversationStates: many(conversationStates),
  engagementSettings: many(organizationEngagementSettings),
  workspaceSettings: many(organizationWorkspaceSettings),
}));

export const organizationMemberRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organization_id],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.user_id],
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
    organization: one(organizations, {
      fields: [organizationIntegrationSecrets.organization_id],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [organizationIntegrationSecrets.organization_integration_id],
      references: [organizationIntegrations.id],
    }),
  }),
);

export const conversationStateRelations = relations(
  conversationStates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [conversationStates.organization_id],
      references: [organizations.id],
    }),
    thread: one(threads, {
      fields: [conversationStates.thread_id],
      references: [threads.id],
    }),
  }),
);

export const leadRelations = relations(leads, ({ one }) => ({
  organization: one(organizations, {
    fields: [leads.organization_id],
    references: [organizations.id],
  }),
  thread: one(threads, {
    fields: [leads.thread_id],
    references: [threads.id],
  }),
}));
