/**
 * Tool / capability gating for the Main Agent.
 *
 * Routing / model selection stays in application/model-router.
 * Meeting-link sharing is a tool on the Main Agent.
 */

import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  getOrgAgent,
  listOrgIntegrations,
} from "@neylonai/domain/billing";
import { getAgent, isDefaultAgent, listAgentDefinitions } from "../domain/registry";
import type { AgentDefinition } from "../domain/types";

/** Tool name → catalog integration that must be enabled for the tool to bind. */
export const TOOL_INTEGRATION_GATES: Record<string, string> = {
  web_search: "web_search",
  relational_query: "database",
  provide_meeting_link: "calcom",
};

export type OrgCapabilitySnapshot = {
  organizationId: string | null;
  enabledAgentIds: Set<string>;
  enabledIntegrationIds: Set<string>;
};

function defaultAgentEnabled(agentId: string): boolean {
  const def = getAgent(agentId);
  return def?.defaultActive ?? false;
}

/** Whether an org has this agent enabled (catalog default if no row). */
export async function isOrgAgentEnabled(
  organizationId: string,
  agentId: string,
): Promise<boolean> {
  try {
    const row = await getOrgAgent(organizationId, agentId);
    if (!row) return defaultAgentEnabled(agentId);
    return Boolean(row.enabled);
  } catch {
    return defaultAgentEnabled(agentId);
  }
}

export async function loadOrgCapabilities(
  organizationId: string | null | undefined,
): Promise<OrgCapabilitySnapshot> {
  if (!organizationId) {
    return {
      organizationId: null,
      enabledAgentIds: new Set(),
      enabledIntegrationIds: new Set(),
    };
  }

  try {
    const knownIds = listAgentDefinitions().map((a) => a.id);
    const [agentFlags, integrationRows] = await Promise.all([
      Promise.all(
        knownIds.map(async (id) => {
          const enabled = await isOrgAgentEnabled(organizationId, id);
          return [id, enabled] as const;
        }),
      ),
      listOrgIntegrations(organizationId),
    ]);

    return {
      organizationId,
      enabledAgentIds: new Set(
        agentFlags.filter(([, on]) => on).map(([id]) => id),
      ),
      enabledIntegrationIds: new Set(
        integrationRows
          .filter((r) => r.enabled)
          .map((r) => r.integration_id),
      ),
    };
  } catch (error) {
    console.error("[loadOrgCapabilities]", error);
    return {
      organizationId,
      enabledAgentIds: new Set(
        listAgentDefinitions()
          .filter((a) => a.defaultActive)
          .map((a) => a.id),
      ),
      enabledIntegrationIds: new Set(),
    };
  }
}

/**
 * Tools the model may call for this agent turn.
 * - Main Agent always may bind tools (filtered by integrations)
 */
export function resolveAgentTools(
  agent: AgentDefinition,
  caps: OrgCapabilitySnapshot,
): StructuredToolInterface[] {
  if (!agent.runnable || agent.kind === "blueprint") {
    return [];
  }

  if (
    caps.organizationId &&
    !isDefaultAgent(agent.id) &&
    !caps.enabledAgentIds.has(agent.id)
  ) {
    return [];
  }

  return agent.tools.filter((tool) => {
    const name =
      typeof (tool as { name?: string }).name === "string"
        ? (tool as { name: string }).name
        : "";

    const requiredIntegration = TOOL_INTEGRATION_GATES[name];
    if (!requiredIntegration) return true;
    if (!caps.organizationId) return false;
    return caps.enabledIntegrationIds.has(requiredIntegration);
  });
}

export function toolNamesKey(tools: StructuredToolInterface[]): string {
  return tools
    .map((t) =>
      typeof (t as { name?: string }).name === "string"
        ? (t as { name: string }).name
        : "?",
    )
    .sort()
    .join(",");
}
