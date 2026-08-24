import type { StructuredToolInterface } from "@langchain/core/tools";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * Human-readable config control for agent Configuration UIs.
 * Never expose LLM / LangGraph / prompt / temperature here.
 */
export type AgentConfigField =
  | {
      key: string;
      label: string;
      description?: string;
      type: "boolean";
      defaultValue?: boolean;
    }
  | {
      key: string;
      label: string;
      description?: string;
      type: "string";
      defaultValue?: string;
      multiline?: boolean;
    }
  | {
      key: string;
      label: string;
      description?: string;
      type: "string_list";
      options: Array<{ value: string; label: string }>;
      defaultValue?: string[];
    }
  | {
      key: string;
      label: string;
      description?: string;
      type: "select";
      options: Array<{ value: string; label: string }>;
      defaultValue?: string;
    };

export type AgentActivityKind =
  | "answered_customer"
  | "used_crm"
  | "escalated_conversation"
  | "shared_meeting_link"
  | "qualified_prospect";

export interface AgentOutcomeMetric {
  key: string;
  label: string;
}

/** Main = default conversational entry. Specialized = optional domain agent. */
export type AgentRole = "main" | "specialized";

/**
 * runtime = handles live turns today.
 * blueprint = demo / future specialized agent (not operational).
 */
export type AgentKind = "runtime" | "blueprint";

/**
 * UI-safe presentation for dashboards.
 * Runtime tools / systemPrompt stay on AgentDefinition but are not shown in primary UI.
 */
export interface AgentManifest {
  id: string;
  name: string;
  /** Short job line, e.g. "Answers customer questions". */
  purpose: string;
  /** Plain-language overview — WHAT before HOW. */
  description: string;
  role: AgentRole;
  kind: AgentKind;
  builtIn: boolean;
  defaultActive: boolean;
  /** Whether this agent can run chat turns today. Blueprints are false. */
  runnable: boolean;
  /** Human-readable capabilities (tools + domains) for the Agents UI. */
  capabilities: string[];
  /** Display-only model label for the dashboard (routing still picks the real model). */
  modelLabel: string;
  outcomeMetric: AgentOutcomeMetric;
  configSchema: AgentConfigField[];
  /**
   * Related / recommended integrations (shown in the agent UI).
   * Not all of these block enabling — see `requiredIntegrationIds`.
   */
  integrationIds: string[];
  /**
   * Integrations that must be enabled before this agent can be turned on.
   * Empty for the Main Agent (and any agent that only needs internal tools).
   */
  requiredIntegrationIds: string[];
  activityKinds: AgentActivityKind[];
  /** Plan tier for entitlements. */
  tier: "basic" | "advanced";
}

/**
 * Contract every agent in the system must satisfy.
 * The product currently registers one Main Agent; capabilities are tools.
 */
export interface AgentDefinition extends AgentManifest {
  /** System prompt template. May include `{today_date}`. Runtime only. */
  systemPrompt: string;
  /** Tools this agent can call. */
  tools: StructuredToolInterface[];
  /** Optional: prepare per-turn context (e.g. inject thread id into tools). */
  onTurnStart?: (ctx: AgentTurnContext) => void | Promise<void>;
}

export interface AgentTurnContext {
  threadId?: string;
  participantExternalId?: string;
  organizationId?: string;
  userInput: string;
}

export interface ConversationMessage {
  role: string;
  content: string;
}

export type AgentEvent =
  | { event: "threadCreated"; data: unknown }
  | { event: "assistantResponse"; data: string }
  /** Discard everything streamed so far this turn — a tool round preceded the answer. */
  | { event: "assistantReset"; data: "reset" }
  | {
      event: "thinkingTips";
      data: { tips: string[]; source: "heuristic" | "llm"; thinking: "true" };
    }
  | {
      event: "conversationEscalated";
      data: { escalated: boolean; status?: string; threadId?: string };
    }
  | {
      event: "handoffContactRequired";
      data: { escalated: false; status: "awaiting_contact"; threadId: string };
    }
  | {
      event: "messagePersisted";
      data: { userMessageId: string; assistantMessageId: string };
    }
  | { event: "done"; data: "end" }
  | { event: "error"; data: { error: string } };

export interface StreamConversationInput {
  agentId?: string;
  userInput: string;
  threadId: string | null;
  organizationId?: string | null;
  participantId?: string | null;
  participantExternalId?: string | null;
  participantAnonymous?: boolean;
  participantName?: string | null;
  participantEmail?: string | null;
  pagePath?: string | null;
  pageQuery?: Record<string, string>;
  /** Correlates all model/tool usage for this HTTP request. */
  requestId?: string | null;
  apiKeyId?: string | null;
  conversationHistory: ConversationMessage[];
}

export type CompiledAgentGraph = {
  streamEvents: (
    state: { messages: BaseMessage[] },
    config: {
      version: "v2";
      configurable?: {
        threadId?: string;
        organizationId?: string;
        agentId?: string;
      };
    },
  ) => AsyncIterable<{
    event: string;
    metadata?: Record<string, string>;
    data?: {
      chunk?: { content?: unknown };
      output?: { messages?: BaseMessage[] };
    };
    parent_ids?: unknown;
  }>;
};

/** Strip runtime-only fields for dashboard / API responses. */
export function toAgentManifest(def: AgentDefinition): AgentManifest {
  return {
    id: def.id,
    name: def.name,
    purpose: def.purpose,
    description: def.description,
    role: def.role,
    kind: def.kind,
    builtIn: def.builtIn,
    defaultActive: def.defaultActive,
    runnable: def.runnable,
    capabilities: def.capabilities,
    modelLabel: def.modelLabel,
    outcomeMetric: def.outcomeMetric,
    configSchema: def.configSchema,
    integrationIds: def.integrationIds,
    requiredIntegrationIds: def.requiredIntegrationIds,
    activityKinds: def.activityKinds,
    tier: def.tier,
  };
}
