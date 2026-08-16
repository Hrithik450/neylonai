import { StateGraph, START, Annotation } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  AIMessage,
  BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";
import type { CompiledAgentGraph } from "../domain/types";
import { meterModelResponse } from "../infrastructure/metering";
import {
  getTurnBillingSignals,
  markTurnCapped,
  recordAgentRound,
  recordToolUse,
} from "../infrastructure/agent-turn-context";
import { MAX_AGENT_TOOL_ROUNDS } from "@neylonai/domain/billing";

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export interface BuildAgentGraphOptions {
  /** Gemini model id selected by the model router. */
  model: string;
  /** Override tool-round cap (tests). */
  maxToolRounds?: number;
  /** Total tool calls across the turn. */
  maxToolCalls?: number;
}

function countToolCalls(messages: BaseMessage[]): number {
  let calls = 0;
  for (const msg of messages) {
    const typed = msg as { tool_calls?: unknown[]; _getType?: () => string };
    const kind = typed._getType?.() ?? "";
    if (
      kind === "ai" &&
      Array.isArray(typed.tool_calls) &&
      typed.tool_calls.length > 0
    ) {
      calls += typed.tool_calls.length;
    }
  }
  return calls;
}

function countToolRounds(messages: BaseMessage[]): number {
  let rounds = 0;
  for (const msg of messages) {
    const typed = msg as { tool_calls?: unknown[]; _getType?: () => string };
    const kind = typed._getType?.() ?? "";
    if (
      kind === "ai" &&
      Array.isArray(typed.tool_calls) &&
      typed.tool_calls.length > 0
    ) {
      rounds += 1;
    }
  }
  return rounds;
}

export { MAX_AGENT_TOOL_ROUNDS };

/**
 * Builds a LangGraph agent graph from a tool list + routed model.
 * Shared by every AgentDefinition — agents differ by prompt/tools, not by graph shape.
 * LLM calls rotate Google API keys on rate-limit / quota errors.
 */
export function buildAgentGraph(
  tools: StructuredToolInterface[],
  options: BuildAgentGraphOptions,
): CompiledAgentGraph {
  const maxRounds = options.maxToolRounds ?? MAX_AGENT_TOOL_ROUNDS;
  const maxCalls = options.maxToolCalls ?? 6;
  const toolNode = new ToolNode<typeof AgentState.State>(tools);

  async function agentNode(state: typeof AgentState.State) {
    recordAgentRound();
    const response = await withGoogleApiRetry(async (apiKey) => {
      const llm = new ChatGoogleGenerativeAI({
        model: options.model,
        temperature: 0.4,
        maxRetries: 0,
        apiKey,
      });
      return llm.bindTools(tools).invoke(state.messages);
    });
    meterModelResponse(options.model, response);

    const withTools = response as AIMessage & {
      tool_calls?: Array<{ name?: string }>;
    };
    if (Array.isArray(withTools.tool_calls)) {
      for (const tc of withTools.tool_calls) {
        if (tc?.name) recordToolUse(tc.name);
      }
    }

    const priorRounds = countToolRounds(state.messages);
    const priorCalls = countToolCalls(state.messages);
    const nextCalls = Array.isArray(withTools.tool_calls)
      ? withTools.tool_calls.length
      : 0;
    const overRounds =
      nextCalls > 0 && priorRounds >= maxRounds;
    const overCalls =
      nextCalls > 0 && priorCalls + nextCalls > maxCalls;
    if (overRounds || overCalls) {
      markTurnCapped(
        overCalls ? `max_tool_calls_${maxCalls}` : `max_tool_rounds_${maxRounds}`,
      );
      return {
        messages: [
          new AIMessage({
            content:
              typeof withTools.content === "string"
                ? withTools.content
                : "I've gathered what I can with the available steps. Here's the best answer based on that.",
            tool_calls: [],
          }),
        ],
      };
    }

    return { messages: [response] };
  }

  async function cappedToolsNode(state: typeof AgentState.State) {
    const billing = getTurnBillingSignals();
    if (billing.agentRounds > maxRounds) {
      markTurnCapped(`max_tool_rounds_${maxRounds}`);
      const last = state.messages[state.messages.length - 1] as AIMessage & {
        tool_calls?: Array<{ id?: string; name?: string }>;
      };
      const stubs =
        last?.tool_calls?.map(
          (tc) =>
            new ToolMessage({
              content: "Tool skipped: per-turn tool round limit reached.",
              tool_call_id: tc.id ?? "unknown",
            }),
        ) ?? [];
      return { messages: stubs };
    }
    return toolNode.invoke(state);
  }

  const workflow = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tools", cappedToolsNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition)
    .addEdge("tools", "agent");

  return workflow.compile() as unknown as CompiledAgentGraph;
}
