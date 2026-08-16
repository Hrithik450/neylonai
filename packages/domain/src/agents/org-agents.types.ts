export type OrgAgentRecord = {
  id: string;
  organizationId: string;
  agentKey: string;
  enabled: boolean;
  extra: Record<string, unknown>;
  createdAt: string | null;
};

export const MAIN_AGENT_KEY = "main-agent";

export const KNOWN_AGENT_KEYS = [MAIN_AGENT_KEY] as const;

export function isMainAgentKey(agentKey: string): boolean {
  return agentKey === MAIN_AGENT_KEY;
}
