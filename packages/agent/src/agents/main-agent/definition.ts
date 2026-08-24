import type { AgentDefinition } from "../../domain/types";
import { prompts } from "../../lib/prompts";
import { semanticSearchTool } from "../../infrastructure/tools/semantic-search.tool";
import { webSearchTool } from "../../infrastructure/tools/web-search.tool";
import { scrapeUrlTool } from "../../infrastructure/tools/scrape-url.tool";
import { relationalQueryTool } from "../../infrastructure/tools/relational-query.tool";
import { notifyTeamTool } from "../../infrastructure/tools/notify-team.tool";
import { escalateToHumanTool } from "../../infrastructure/tools/escalate-to-human.tool";
import { provideMeetingLinkTool } from "../../infrastructure/tools/provide-meeting-link.tool";

/**
 * Main Agent — single conversational entry point for the MVP.
 *
 * Capabilities are tools (knowledge, meeting link, notifications), not separate agents.
 * Human handoff runs through escalate_to_human, which performs the real action:
 * it flags the thread, records it in the inbox, and stops the AI. Deterministic
 * detection in application/stream-conversation stays as a fast backstop.
 * Model selection stays in application/model-router (independent of this definition).
 */
export const mainAgent: AgentDefinition = {
  id: "main-agent",
  name: "Main Agent",
  purpose: "Primary conversational agent",
  description:
    "The single entry point for visitor chats. It answers from your knowledge, can share a meeting URL, escalate to a human, and use connected tools.",
  role: "main",
  kind: "runtime",
  builtIn: true,
  defaultActive: true,
  runnable: true,
  tier: "basic",
  capabilities: [
    "Knowledge search",
    "Meeting link",
    "Human escalation",
    "Web search",
    "Database query",
  ],
  modelLabel: "Routed (low / medium / high)",
  outcomeMetric: { key: "questions_answered", label: "Conversations handled" },
  integrationIds: [
    "website",
    "database",
    "web_search",
    "whatsapp",
    "calcom",
  ],
  requiredIntegrationIds: [],
  activityKinds: [
    "answered_customer",
    "escalated_conversation",
    "shared_meeting_link",
  ],
  configSchema: [],
  systemPrompt: prompts.mainAgentSystem,
  tools: [
    semanticSearchTool,
    relationalQueryTool,
    scrapeUrlTool,
    webSearchTool,
    provideMeetingLinkTool,
    escalateToHumanTool,
    notifyTeamTool,
  ],
};
