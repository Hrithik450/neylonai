import { getOrgAgent } from "@neylonai/domain/billing";

export const DEFAULT_LEAD_FIELDS = ["name", "email", "company"] as const;

export type LeadAgentSettings = {
  enabled: boolean;
  leadFields: string[];
};

/**
 * Lead Agent workspace config — owned by `organization_agents` (agent_id = lead).
 * Not stored on organization_engagement_settings.
 */
export async function getLeadAgentSettings(
  organizationId: string,
): Promise<LeadAgentSettings> {
  try {
    const row = await getOrgAgent(organizationId, "lead");
    if (!row) {
      return {
        enabled: true,
        leadFields: [...DEFAULT_LEAD_FIELDS],
      };
    }

    const config = (row.config ?? {}) as Record<string, unknown>;
    const configEnabled =
      typeof config.leadAgentEnabled === "boolean"
        ? config.leadAgentEnabled
        : true;
    const fields = Array.isArray(config.leadFields)
      ? config.leadFields.filter((f): f is string => typeof f === "string")
      : [...DEFAULT_LEAD_FIELDS];

    return {
      enabled: Boolean(row.enabled) && configEnabled,
      leadFields: fields.length > 0 ? fields : [...DEFAULT_LEAD_FIELDS],
    };
  } catch (error) {
    console.error("[getLeadAgentSettings]", error);
    return {
      enabled: true,
      leadFields: [...DEFAULT_LEAD_FIELDS],
    };
  }
}
