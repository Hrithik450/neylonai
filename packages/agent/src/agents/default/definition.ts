import type { AgentDefinition } from "../../domain/types";
import { prompts } from "../../lib/prompts";
import { semanticSearchTool } from "../../infrastructure/tools/semantic-search.tool";
import { webSearchTool } from "../../infrastructure/tools/web-search.tool";
import { scrapeUrlTool } from "../../infrastructure/tools/scrape-url.tool";
import { relationalQueryTool } from "../../infrastructure/tools/relational-query.tool";
import {
  notifyTeamTool,
} from "../../infrastructure/tools/notify-team.tool";
import {
  escalateToHumanTool,
} from "../../infrastructure/tools/escalate-to-human.tool";

/**
 * Support Agent — answers customer questions from knowledge (+ optional web search).
 * Lead capture lives on the Lead Agent — not here.
 * Booking lives on the Booking Agent — orchestrator delegates after confirmation.
 * Human handoff uses escalate_to_human + application/escalation detectors.
 */
export const neylonaiChatbotAgent: AgentDefinition = {
  id: "neylonai-chatbot",
  name: "Support Agent",
  purpose: "Answers customer questions",
  description:
    "Helps visitors with product and support questions using your knowledge base. When a human is needed, it escalates the conversation for team follow-up and pauses AI replies so your team can take over.",
  builtIn: true,
  defaultActive: true,
  runnable: true,
  tier: "basic",
  outcomeMetric: { key: "questions_answered", label: "Questions answered" },
  integrationIds: ["website", "database", "pdf", "web_search"],
  /** Default agent — internal tools only; knowledge integrations are recommended, not required to enable. */
  requiredIntegrationIds: [],
  activityKinds: [
    "answered_customer",
    "escalated_conversation",
  ],
  configSchema: [
    {
      key: "humanHandoffEnabled",
      label: "Allow human handoff",
      description:
        "When enabled, the agent can escalate for follow-up and pause AI when a person is needed.",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "escalationExplicitRequest",
      label: "Escalate when customer asks for a human",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "escalationFrustration",
      label: "Escalate on clear frustration",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "escalationUnhelpful",
      label: "Escalate when help isn’t working",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "availabilityMode",
      label: "Follow-up timing note",
      description:
        "Async follow-up only — never live chat. Optionally append a business-hours note.",
      type: "select",
      options: [
        { value: "always", label: "Standard follow-up message" },
        { value: "business_hours", label: "Append business-hours note" },
        { value: "collect_contact", label: "Standard follow-up (collect contact if needed)" },
      ],
      defaultValue: "collect_contact",
    },
    {
      key: "defaultTeam",
      label: "Default team for escalations",
      type: "string",
      defaultValue: "support",
    },
    {
      key: "customerHandoffMessage",
      label: "Message when a conversation is escalated",
      type: "string",
      multiline: true,
      defaultValue:
        "I’ve sent your request to our team along with the conversation details. They’ll review it and get back to you as soon as possible.",
    },
    {
      key: "unavailableMessage",
      label: "Legacy fallback handoff message",
      description: "Kept for older workspaces; new escalations use the message above.",
      type: "string",
      multiline: true,
      defaultValue:
        "I’ve sent your request to our team along with the conversation details. They’ll review it and get back to you as soon as possible.",
    },
  ],
  systemPrompt: prompts.neylonaiChatbotSystem,
  tools: [
    semanticSearchTool,
    relationalQueryTool,
    scrapeUrlTool,
    webSearchTool,
    notifyTeamTool,
    escalateToHumanTool,
  ],
};
