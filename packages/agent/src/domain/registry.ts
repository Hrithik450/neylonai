import type { AgentDefinition, AgentManifest } from "./types";
import { toAgentManifest } from "./types";

const agents = new Map<string, AgentDefinition>();
let defaultAgentId: string | null = null;

/** Registers an agent. The first registered agent becomes the default. */
export function registerAgent(definition: AgentDefinition): void {
  agents.set(definition.id, definition);
  if (defaultAgentId === null) defaultAgentId = definition.id;
}

export function getAgent(id: string): AgentDefinition | undefined {
  return agents.get(id);
}

export function getDefaultAgent(): AgentDefinition {
  if (!defaultAgentId) {
    throw new Error(
      "No agents registered. Import and register at least one agent definition.",
    );
  }
  const agent = agents.get(defaultAgentId);
  if (!agent) {
    throw new Error(`Default agent "${defaultAgentId}" is missing from registry.`);
  }
  return agent;
}

export function listAgentDefinitions(): AgentDefinition[] {
  return Array.from(agents.values());
}

export function listAgentManifests(): AgentManifest[] {
  return listAgentDefinitions().map(toAgentManifest);
}

export function getAgentManifest(id: string): AgentManifest | undefined {
  const def = agents.get(id);
  return def ? toAgentManifest(def) : undefined;
}

export function getDefaultAgentId(): string | null {
  return defaultAgentId;
}

export function isDefaultAgent(id: string): boolean {
  return defaultAgentId === id;
}

export function setDefaultAgent(id: string): void {
  if (!agents.has(id)) {
    throw new Error(`Cannot set default: agent "${id}" is not registered.`);
  }
  defaultAgentId = id;
}
