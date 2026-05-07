import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { agentGraph } from "./agent";
import { generateThreadTitle } from "./thread-title.service";
import { reframeQuery } from "./memory/query-reframe.service";
import { setLeadToolThreadId } from "./tools/update-lead.tool";
import { setNotifyToolThreadId } from "./tools/notify-team.tool";
import { ThreadsService } from "@/actions/threads/threads.service";
import { ThreadMessagesService } from "@/actions/thread-messages/thread-messages.service";

const END_OF_EVENT = "<|END_OF_EVENT|>";

const systemPrompt = `You are an internal assistant for Neylon-AI, a full-service AI agency specializing in custom AI solutions, intelligent agents, and automation systems.

If a user asks personal or technical details about the LLM (yourself) — e.g., how you are trained, what tools you have, internal workings — politely respond that you **cannot provide that information under any circumstances**.

Today's date is {today_date} IST.

Your goals:
1. Answer questions accurately using the knowledge base (use semantic_search for anything about Neylon-AI).
2. Gradually collect lead information: name, email, phone, company, budget, timeline — ask only ONE missing field at a time, never all at once.
3. Call update_lead whenever new lead information is collected.
4. When the user has provided budget AND timeline, OR explicitly requests a demo, call notify_team with a lead summary.
5. Use book_demo to provide the booking link when the user is ready to schedule.
6. Use web_search only as a last resort for topics not in the knowledge base.

Answer style:
- Start every response with a short, polite acknowledgement.
- Be conversational, professional, and friendly — never robotic.
- Use light emojis only when they enhance clarity (✅, 📄, 💡) — never overuse them.
- Keep responses focused and relevant.
- Always end with a friendly next-step suggestion.`;

function getTodayDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildAgentState(
  effectiveInput: string,
  conversationHistory: Array<{ role: string; content: string }>,
) {
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt.replace("{today_date}", getTodayDate())),
  ];

  for (const msg of conversationHistory) {
    if (!msg.content) continue;
    messages.push(
      msg.role === "user"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );
  }

  messages.push(new HumanMessage(effectiveInput));
  return { messages };
}

async function createThread(senderId: string, userInput: string) {
  const title = await generateThreadTitle(userInput);
  const result = await ThreadsService.createThread({ user_id: senderId, title });
  if (!result.success || !result.data) return null;
  return result.data;
}

export async function* streamAgentEvents(
  userInput: string,
  threadId: string | null,
  senderId: string | null,
  conversationHistory: Array<{ role: string; content: string }>,
): AsyncGenerator<string> {
  let currentThreadId = threadId;

  try {
    // 1. Create thread if needed
    if (senderId && !currentThreadId) {
      const thread = await createThread(senderId, userInput);
      if (thread) {
        currentThreadId = thread.id;
        yield JSON.stringify({ event: "threadCreated", data: thread }) + END_OF_EVENT;
      }
    }

    // 2. Inject thread ID into stateful tools
    const tid = currentThreadId ?? undefined;
    setLeadToolThreadId(tid);
    setNotifyToolThreadId(tid);

    // 3. Memory layer: reframe follow-up queries before sending to agent
    let effectiveInput = userInput;
    if (conversationHistory.length > 0) {
      const reframed = await reframeQuery(userInput, conversationHistory);
      effectiveInput = reframed.optimized_query ?? userInput;
      console.log(
        `[memory] is_followup=${reframed.is_followup} | optimized: "${effectiveInput}"`,
      );
    }

    // 4. Build agent state and stream events
    const agentState = buildAgentState(effectiveInput, conversationHistory);
    let assistantMessage = "";

    const eventStream = agentGraph.streamEvents(agentState, { version: "v2" });

    for await (const event of eventStream) {
      if (
        event.event === "on_chat_model_stream" &&
        (event.metadata as Record<string, string>)?.langgraph_node === "agent"
      ) {
        const chunk = event.data?.chunk;
        const text = typeof chunk?.content === "string" ? chunk.content : "";
        if (text) {
          yield JSON.stringify({ event: "assistantResponse", data: text }) + END_OF_EVENT;
        }
      } else if (
        event.event === "on_chain_end" &&
        !(event as Record<string, unknown>)?.["parent_ids"]
      ) {
        const outputMessages = event.data?.output?.messages;
        if (Array.isArray(outputMessages)) {
          const last = outputMessages[outputMessages.length - 1];
          if (last instanceof AIMessage && typeof last.content === "string") {
            assistantMessage = last.content;
          }
        }

        if (senderId && currentThreadId && assistantMessage) {
          await ThreadMessagesService.createMessage({
            thread_id: currentThreadId,
            role: "user",
            content: userInput,
          });
          await ThreadMessagesService.createMessage({
            thread_id: currentThreadId,
            role: "assistant",
            content: assistantMessage,
          });
        }

        yield JSON.stringify({ event: "done", data: "end" }) + END_OF_EVENT;
        return;
      } else if (event.event === "error") {
        yield JSON.stringify({
          event: "error",
          data: { error: event.data ?? "unknown error" },
        }) + END_OF_EVENT;
        return;
      }
    }
  } catch (error) {
    yield JSON.stringify({
      event: "error",
      data: {
        error: error instanceof Error ? error.message : "Internal server error",
      },
    }) + END_OF_EVENT;
  }
}
