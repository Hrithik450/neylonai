import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getAgentTurnContext } from "../../infrastructure/agent-turn-context";
import { getLeadAgentSettings } from "./settings";
import {
  upsertLeadRecord,
  type LeadFieldKey,
} from "./persistence";

const ALL_FIELDS: LeadFieldKey[] = [
  "name",
  "email",
  "phone",
  "company",
  "budget",
  "timeline",
];

/**
 * Lead Agent capture tool — persists configured fields via Lead Agent persistence.
 * Chatbot must not duplicate this logic.
 */
export const captureLeadTool = tool(
  async (input: Record<string, string | undefined>) => {
    const leadToolContext = getAgentTurnContext();
    const organizationId = leadToolContext.organizationId;
    if (!organizationId) {
      return "Lead capture unavailable (missing organization).";
    }

    const settings = await getLeadAgentSettings(organizationId);
    if (!settings.enabled) {
      return "Lead Agent is disabled for this workspace.";
    }

    const allowed = new Set(
      (settings.leadFields.length
        ? settings.leadFields
        : ["name", "email", "company"]) as string[],
    );

    const filtered: Record<string, string | undefined> = {};
    for (const key of ALL_FIELDS) {
      if (allowed.has(key) && input[key]) {
        filtered[key] = input[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return `No configured lead fields provided. Collect only: ${[...allowed].join(", ")}.`;
    }

    const result = await upsertLeadRecord(
      {
        ...filtered,
        organization_id: organizationId,
        thread_id: leadToolContext.threadId,
        source_agent_id: "lead",
        status: "new",
      },
      leadToolContext.threadId,
    );

    return `${result.message} (id: ${result.id}). CRM sync is pending until an integration is connected.`;
  },
  {
    name: "capture_lead",
    description:
      "Capture or update a platform lead using only the workspace’s configured lead fields. Call when the visitor provides contact or qualification details.",
    schema: z.object({
      name: z.string().optional().describe("Full name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      budget: z.string().optional().describe("Budget"),
      timeline: z.string().optional().describe("Timeline"),
    }),
  },
);
