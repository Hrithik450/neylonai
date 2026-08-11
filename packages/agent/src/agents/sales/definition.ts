import type { AgentDefinition } from "../../domain/types";

/**
 * Sales Agent — inactive stub. Manifest-driven UI only until chat selection ships.
 */
export const salesAgent: AgentDefinition = {
  id: "sales",
  name: "Sales Agent",
  purpose: "Qualifies prospects",
  description:
    "Qualifies prospects in conversation and surfaces buying signals for your sales team. Not active on live chats yet — enable when you’re ready to use it.",
  builtIn: false,
  defaultActive: false,
  runnable: false,
  tier: "advanced",
  outcomeMetric: { key: "prospects_qualified", label: "Prospects qualified" },
  integrationIds: ["hubspot", "salesforce", "slack", "webhooks"],
  requiredIntegrationIds: ["hubspot"],
  activityKinds: ["qualified_prospect", "captured_lead", "used_crm"],
  configSchema: [
    {
      key: "salesAgentEnabled",
      label: "Enable Sales Agent",
      description: "Turn on when you’re ready for prospect qualification.",
      type: "boolean",
      defaultValue: false,
    },
  ],
  systemPrompt: "You qualify sales prospects. This agent is not yet active.",
  tools: [],
};
