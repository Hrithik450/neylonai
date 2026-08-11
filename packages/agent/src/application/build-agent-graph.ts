import { StateGraph, START, Annotation } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";
import type { CompiledAgentGraph } from "../domain/types";
import { meterModelResponse } from "../infrastructure/metering";

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export interface BuildAgentGraphOptions {
  /** Gemini model id selected by the model router. */
  model: string;
}

/**
 * Builds a LangGraph agent graph from a tool list + routed model.
 * Shared by every AgentDefinition — agents differ by prompt/tools, not by graph shape.
 * LLM calls rotate Google API keys on rate-limit / quota errors.
 */
export function buildAgentGraph(
  tools: StructuredToolInterface[],
  options: BuildAgentGraphOptions,
): CompiledAgentGraph {
  const toolNode = new ToolNode<typeof AgentState.State>(tools);

  async function agentNode(state: typeof AgentState.State) {
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
    return { messages: [response] };
  }

  const workflow = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition)
    .addEdge("tools", "agent");

  return workflow.compile() as unknown as CompiledAgentGraph;
}
