import type { AgentDefinition } from "../../domain/types";
import { prompts } from "../../lib/prompts";
import { captureLeadTool } from "./capture-lead.tool";

/**
 * Dedicated Lead Agent — identify, qualify, and capture leads.
 * Never mixed into the Support Agent definition.
 * Leads stay accessible via conversation + agent context; CRM via integrations.
 */
export const leadAgent: AgentDefinition = {
  id: "lead",
  name: "Lead Agent",
  purpose: "Captures and qualifies leads",
  description:
    "Watches conversations for buying interest, collects the contact details you care about, and saves leads so your team (or CRM) can follow up. Works alongside Support Agent — it does not replace answering questions.",
  builtIn: true,
  defaultActive: true,
  runnable: true,
  tier: "basic",
  outcomeMetric: { key: "leads_captured", label: "Leads captured" },
  integrationIds: ["hubspot", "salesforce", "webhooks", "slack"],
  /** Capture works with internal tools; CRM sync integrations are optional until wired. */
  requiredIntegrationIds: [],
  activityKinds: [
    "captured_lead",
    "qualified_lead",
    "used_crm",
  ],
  configSchema: [
    {
      key: "leadAgentEnabled",
      label: "Capture leads from conversations",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "leadFields",
      label: "Fields to collect",
      description: "Only ask for what you need to follow up.",
      type: "string_list",
      options: [
        { value: "name", label: "Name" },
        { value: "email", label: "Email" },
        { value: "phone", label: "Phone" },
        { value: "company", label: "Company" },
        { value: "budget", label: "Budget" },
        { value: "timeline", label: "Timeline" },
      ],
      defaultValue: ["name", "email", "company"],
    },
  ],
  systemPrompt: prompts.leadAgentSystem,
  tools: [captureLeadTool],
};
