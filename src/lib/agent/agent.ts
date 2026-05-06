import { StateGraph, START, Annotation } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseMessage } from "@langchain/core/messages";

import { semanticSearchTool } from "./tools/semantic-search.tool";
import { webSearchTool } from "./tools/web-search.tool";
import { updateLeadTool } from "./tools/update-lead.tool";
import { bookDemoTool } from "./tools/book-demo.tool";
import { notifyTeamTool } from "./tools/notify-team.tool";

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export const agentTools = [
  semanticSearchTool,
  webSearchTool,
  updateLeadTool,
  bookDemoTool,
  notifyTeamTool,
];

const toolNode = new ToolNode<typeof AgentState.State>(agentTools);

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  temperature: 0.4,
  maxRetries: 2,
  apiKey: process.env.GOOGLE_API_KEY,
});

const llmWithTools = llm.bindTools(agentTools);

async function agentNode(state: typeof AgentState.State) {
  const response = await llmWithTools.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", toolsCondition)
  .addEdge("tools", "agent");

export const agentGraph = workflow.compile();
