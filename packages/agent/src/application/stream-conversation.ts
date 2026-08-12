import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  ThreadsService,
  ThreadMessagesService,
} from "@neylonai/domain/chat";
import { VisitorsService } from "@neylonai/domain/visitors";
import { generateThreadTitle } from "../lib/generate-thread-title";
import {
  canAiRespond,
  ensureConversationState,
  escalateConversation,
  getConversationStateByThread,
  getEngagementSettings,
  recordLastAgent,
} from "@neylonai/domain/conversations";
import { toDashboardProvenance } from "@neylonai/domain/knowledge";
import { resolveKnowledgeScope } from "@neylonai/database";
import { getAgent, getDefaultAgent } from "../domain/registry";
import type { AgentDefinition, StreamConversationInput } from "../domain/types";
import {
  getAgentTurnContext,
  patchAgentTurnContext,
  takeProvenanceHits,
  withAgentTurnContext,
} from "../infrastructure/agent-turn-context";
import { buildAgentGraph } from "./build-agent-graph";
import { reframeQuery } from "./reframe-query";
import { routeModel } from "./model-router";
import {
  buildHeuristicTips,
  startThinkingTipsRefresh,
} from "./thinking-tips";
import {
  buildHandoffSummary,
  detectEscalation,
} from "./escalation";
import { maybeCaptureLeadFromUserMessage } from "./lead-capture-bridge";
import {
  BOOKING_CONFIRM_MESSAGE,
  BOOKING_DECLINED_MESSAGE,
  BOOKING_UNAVAILABLE_MESSAGE,
  detectBookingBridgePhase,
} from "./booking-bridge";
import {
  loadOrgCapabilities,
  resolveAgentTools,
  toolNamesKey,
  type OrgCapabilitySnapshot,
} from "./resolve-agent-tools";
import { getTodayDate } from "../lib/date";

function sseEvent(payload: object): string {
  return "data: " + JSON.stringify(payload) + "\n\n";
}

function tipEvent(tips: string[], source: "heuristic" | "llm"): string {
  return sseEvent({ event: "thinkingTips", data: { tips, source, thinking: "true" } });
}

/** LangChain content may be a string or array of text parts. */
function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      typeof part === "string"
        ? part
        : part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
    )
    .join("");
}

/**
 * Read the last assistant turn from graph output without `instanceof`.
 * Duplicate @langchain/core copies in the monorepo break instanceof checks.
 */
function extractLastAssistantText(messages: unknown): string {
  if (!Array.isArray(messages) || messages.length === 0) return "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;

    const typed = msg as {
      content?: unknown;
      type?: string;
      role?: string;
      _getType?: () => string;
    };

    let kind = "";
    try {
      kind = typed._getType?.() ?? typed.type ?? typed.role ?? "";
    } catch {
      kind = typed.type ?? typed.role ?? "";
    }

    const isAssistant =
      kind === "ai" ||
      kind === "assistant" ||
      msg instanceof AIMessage;

    if (!isAssistant && kind) continue;

    const text = extractMessageText(typed.content);
    if (text) return text;
    if (isAssistant) return "";
  }

  return "";
}

async function persistUserMessage(input: {
  threadId: string;
  userInput: string;
}): Promise<boolean> {
  const userResult = await ThreadMessagesService.createMessage({
    thread_id: input.threadId,
    role: "user",
    content: input.userInput,
  });
  if (!userResult.success) {
    console.error(
      "[streamConversation] user message persist failed:",
      userResult.error,
    );
    return false;
  }
  return true;
}

async function persistAssistantMessage(input: {
  threadId: string;
  assistantMessage: string;
  agentId?: string | null;
  agentName?: string | null;
}): Promise<boolean> {
  if (!input.assistantMessage.trim()) return true;

  const turn = getAgentTurnContext();
  const agentId = input.agentId ?? turn.agentId ?? null;
  const hits = takeProvenanceHits();
  let metadata: Record<string, unknown> = {};
  if (input.agentName) {
    metadata.agent_name = input.agentName;
  }
  if (agentId) {
    metadata.agent_id = agentId;
  }
  if (hits.length > 0 && turn.organizationId) {
    const provenance = await toDashboardProvenance({
      organizationId: turn.organizationId,
      agentId: agentId ?? turn.agentId,
      hits,
    });
    if (provenance) {
      metadata = { ...metadata, provenance };
    }
  }

  const assistantResult = await ThreadMessagesService.createMessage({
    thread_id: input.threadId,
    role: "assistant",
    content: input.assistantMessage,
    agent_id: agentId,
    metadata,
  });
  if (!assistantResult.success) {
    console.error(
      "[streamConversation] assistant message persist failed:",
      assistantResult.error,
    );
    return false;
  }
  return true;
}

async function persistTurnMessages(input: {
  threadId: string;
  userInput: string;
  assistantMessage: string;
  userAlreadyPersisted?: boolean;
}): Promise<boolean> {
  if (!input.userAlreadyPersisted) {
    const ok = await persistUserMessage(input);
    if (!ok) return false;
  }
  return persistAssistantMessage(input);
}

const GRAPH_CACHE_MAX = 32;
const graphCache = new Map<string, ReturnType<typeof buildAgentGraph>>();

function getOrCreateGraph(
  cacheKey: string,
  tools: AgentDefinition["tools"],
  model: string,
) {
  const existing = graphCache.get(cacheKey);
  if (existing) {
    graphCache.delete(cacheKey);
    graphCache.set(cacheKey, existing);
    return existing;
  }

  const graph = buildAgentGraph(tools, { model });
  graphCache.set(cacheKey, graph);
  while (graphCache.size > GRAPH_CACHE_MAX) {
    const oldest = graphCache.keys().next().value;
    if (oldest === undefined) break;
    graphCache.delete(oldest);
  }
  return graph;
}

/** Record last agent that spoke — not exclusive thread ownership. */
async function touchLastAgent(
  threadId: string,
  agentId: string,
): Promise<void> {
  try {
    await recordLastAgent({ threadId, agentId });
  } catch (error) {
    console.error("[streamConversation] touchLastAgent failed", error);
  }
}

function buildAgentState(
  systemPrompt: string,
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
  const ensured = await VisitorsService.ensureVisitor(senderId);
  if (!ensured.success) {
    console.error("[streamConversation] cannot resolve visitor", {
      senderId,
      error: ensured.error,
    });
    return null;
  }

  const title = await generateThreadTitle(userInput);
  const result = await ThreadsService.createThread({
    user_id: senderId,
    title,
  });
  if (!result.success || !result.data) return null;
  return result.data;
}

/**
 * Streams a conversation turn for a registered agent.
 * Yields delimited JSON event strings compatible with the existing SSE-like protocol.
 */
export async function* streamConversation(
  input: StreamConversationInput,
): AsyncGenerator<string> {
  const agent = input.agentId
    ? getAgent(input.agentId)
    : getDefaultAgent();
  if (!agent) {
    yield sseEvent({
      event: "error",
      data: { error: `Unknown agent: ${input.agentId}` },
    });
    return;
  }

  yield* withAgentTurnContext(
    {
      threadId: input.threadId ?? undefined,
      organizationId: input.organizationId ?? undefined,
      agentId: agent.id,
      requestId: input.requestId ?? undefined,
      apiKeyId: input.apiKeyId ?? undefined,
    },
    streamConversationTurn(input, agent),
  );
}

async function bindKnowledgeScopeToTurn(organizationId: string): Promise<void> {
  try {
    const scope = await resolveKnowledgeScope({ organizationId });
    if (!scope) {
      console.error(
        "[streamConversation] knowledge scope missing for organization",
        organizationId,
      );
      return;
    }
    patchAgentTurnContext({
      organizationId: scope.organizationId,
    });
  } catch (error) {
    console.error(
      "[streamConversation] failed to resolve knowledge scope:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function* streamConversationTurn(
  input: StreamConversationInput,
  agent: AgentDefinition,
): AsyncGenerator<string> {
  const {
    userInput,
    threadId,
    senderId,
    organizationId,
    conversationHistory,
  } = input;

  let currentThreadId = threadId;
  /** Agent that will author the assistant turn (may hand off mid-flow). */
  let activeAgent = agent;

  try {
    const caps: OrgCapabilitySnapshot =
      await loadOrgCapabilities(organizationId ?? null);

    if (organizationId) {
      await bindKnowledgeScopeToTurn(organizationId);
    }

    if (senderId && !currentThreadId) {
      const thread = await createThread(senderId, userInput);
      if (thread) {
        currentThreadId = thread.id;
        patchAgentTurnContext({ threadId: currentThreadId });
        yield sseEvent({ event: "threadCreated", data: thread });
      }
    }

    // Persist the human turn immediately so interrupt/follow-up never drops it.
    let userPersisted = false;
    let assistantPersisted = false;
    if (currentThreadId) {
      userPersisted = await persistUserMessage({
        threadId: currentThreadId,
        userInput,
      });
    }

    if (organizationId && currentThreadId) {
      await ensureConversationState({
        organizationId,
        threadId: currentThreadId,
        assignedAgentId: activeAgent.id,
      });
      if (senderId) {
        await ThreadsService.invalidateUserThreadCaches(
          senderId,
          organizationId,
        );
      }

      const state = await getConversationStateByThread(currentThreadId);
      if (!canAiRespond(state)) {
        const msg =
          state?.status === "resolved"
            ? "This conversation is resolved. Start a new chat if you need more help."
            : state?.status === "escalated" || state?.aiPaused
              ? `Your request is with our team (reference ${currentThreadId.replace(/-/g, "").slice(0, 8).toUpperCase()}). They’ll follow up as soon as possible — I’m not able to continue this chat while it’s with them.`
              : "Your request has been sent to our team. They’ll follow up as soon as possible — I’m not able to continue this chat while it’s with them.";
        await persistAssistantMessage({
          threadId: currentThreadId,
          assistantMessage: msg,
          agentId: activeAgent.id,
          agentName: activeAgent.name,
        });
        assistantPersisted = true;
        await touchLastAgent(currentThreadId, activeAgent.id);
        yield sseEvent({ event: "assistantResponse", data: msg });
        yield sseEvent({ event: "done", data: "end" });
        return;
      }

      const settings = await getEngagementSettings(organizationId);
      const decision = detectEscalation(
        userInput,
        conversationHistory,
        settings,
      );
      if (decision.shouldEscalate && decision.trigger && decision.reason) {
        const summary = buildHandoffSummary(conversationHistory, userInput);
        const result = await escalateConversation({
          organizationId,
          threadId: currentThreadId,
          reason: decision.reason,
          trigger: decision.trigger,
          summary,
          escalatedByAgentId: activeAgent.id,
          context: {
            agentName: activeAgent.name,
            customer: senderId
              ? { id: senderId, anonymous: !senderId }
              : null,
            transcript: [
              ...conversationHistory.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              { role: "user", content: userInput },
            ],
          },
        });

        await persistAssistantMessage({
          threadId: currentThreadId,
          assistantMessage: result.customerMessage,
          agentId: activeAgent.id,
          agentName: activeAgent.name,
        });
        assistantPersisted = true;
        await touchLastAgent(currentThreadId, activeAgent.id);

        yield sseEvent({
          event: "assistantResponse",
          data: result.customerMessage,
        });
        yield sseEvent({
          event: "conversationEscalated",
          data: {
            reference: result.reference,
            status: "escalated",
          },
        });
        yield sseEvent({ event: "done", data: "end" });
        return;
      }

      // Booking orchestrator bridge (Support → confirm → Booking Agent).
      if (activeAgent.id === "neylonai-chatbot") {
        const bookingPhase = detectBookingBridgePhase(
          userInput,
          conversationHistory,
        );

        if (bookingPhase === "ask_confirm") {
          await persistAssistantMessage({
            threadId: currentThreadId,
            assistantMessage: BOOKING_CONFIRM_MESSAGE,
            agentId: activeAgent.id,
            agentName: activeAgent.name,
          });
          assistantPersisted = true;
          await touchLastAgent(currentThreadId, activeAgent.id);
          yield sseEvent({
            event: "assistantResponse",
            data: BOOKING_CONFIRM_MESSAGE,
          });
          yield sseEvent({ event: "done", data: "end" });
          return;
        }

        if (bookingPhase === "declined") {
          await persistAssistantMessage({
            threadId: currentThreadId,
            assistantMessage: BOOKING_DECLINED_MESSAGE,
            agentId: activeAgent.id,
            agentName: activeAgent.name,
          });
          assistantPersisted = true;
          await touchLastAgent(currentThreadId, activeAgent.id);
          yield sseEvent({
            event: "assistantResponse",
            data: BOOKING_DECLINED_MESSAGE,
          });
          yield sseEvent({ event: "done", data: "end" });
          return;
        }

        if (bookingPhase === "confirmed") {
          const bookingEnabled = caps.enabledAgentIds.has("booking");
          const calcomEnabled = caps.enabledIntegrationIds.has("calcom");
          if (!bookingEnabled || !calcomEnabled) {
            await persistAssistantMessage({
              threadId: currentThreadId,
              assistantMessage: BOOKING_UNAVAILABLE_MESSAGE,
              agentId: activeAgent.id,
              agentName: activeAgent.name,
            });
            assistantPersisted = true;
            await touchLastAgent(currentThreadId, activeAgent.id);
            yield sseEvent({
              event: "assistantResponse",
              data: BOOKING_UNAVAILABLE_MESSAGE,
            });
            yield sseEvent({ event: "done", data: "end" });
            return;
          }

          const bookingAgent = getAgent("booking");
          if (!bookingAgent?.runnable) {
            await persistAssistantMessage({
              threadId: currentThreadId,
              assistantMessage: BOOKING_UNAVAILABLE_MESSAGE,
              agentId: activeAgent.id,
              agentName: activeAgent.name,
            });
            assistantPersisted = true;
            await touchLastAgent(currentThreadId, activeAgent.id);
            yield sseEvent({
              event: "assistantResponse",
              data: BOOKING_UNAVAILABLE_MESSAGE,
            });
            yield sseEvent({ event: "done", data: "end" });
            return;
          }

          // Hand off this turn to Booking Agent (same thread).
          activeAgent = bookingAgent;
          patchAgentTurnContext({ agentId: bookingAgent.id });
        }
      }

      // Lead Agent path (orchestrator bridge — not chatbot tools).
      await maybeCaptureLeadFromUserMessage({
        organizationId,
        threadId: currentThreadId,
        userInput,
      });
    }

    await activeAgent.onTurnStart?.({
      threadId: currentThreadId ?? undefined,
      senderId: senderId ?? undefined,
      organizationId: organizationId ?? undefined,
      userInput,
    });

    // Instant tips so the UI never sits on a blank spinner.
    const heuristicTips = buildHeuristicTips(userInput);
    yield tipEvent(heuristicTips.tips, "heuristic");

    // LLM tip refresh runs in parallel with reframe + routing (hard timeout inside).
    const tipsRefresh = startThinkingTipsRefresh(userInput);

    let effectiveInput = userInput;
    if (conversationHistory.length > 0) {
      const reframed = await reframeQuery(userInput, conversationHistory);
      effectiveInput = reframed.optimized_query ?? userInput;
      console.log(
        `[memory] is_followup=${reframed.is_followup} | optimized: "${effectiveInput}"`,
      );
    }

    const route = await routeModel(effectiveInput);
    console.log(
      `[model-router] complexity=${route.complexity} model=${route.model} source=${route.source}`,
    );

    const upgraded = await tipsRefresh;
    if (upgraded?.tips.length) {
      yield tipEvent(upgraded.tips, "llm");
      console.log(`[thinking-tips] upgraded via llm (${upgraded.tips.length})`);
    }

    const tools = resolveAgentTools(activeAgent, caps);
    const cacheKey = `${activeAgent.id}:${route.model}:${toolNamesKey(tools)}`;
    const graph = getOrCreateGraph(cacheKey, tools, route.model);

    const agentState = buildAgentState(
      activeAgent.systemPrompt,
      effectiveInput,
      conversationHistory,
    );
    /** Prefer final graph output; fall back to tokens streamed to the client. */
    let assistantMessage = "";
    let streamedAssistant = "";

    try {
      const eventStream = graph.streamEvents(agentState, {
        version: "v2",
        configurable: {
          threadId: currentThreadId ?? undefined,
          organizationId: organizationId ?? undefined,
          agentId: activeAgent.id,
        },
      });

      for await (const event of eventStream) {
        const parentIds = (event as { parent_ids?: string[] }).parent_ids;
        // LangGraph root events use an empty parent_ids array — not undefined.
        const isRootChainEnd =
          event.event === "on_chain_end" &&
          Array.isArray(parentIds) &&
          parentIds.length === 0;

        if (
          event.event === "on_chat_model_stream" &&
          event.metadata?.langgraph_node === "agent"
        ) {
          const chunk = event.data?.chunk;
          const raw = chunk?.content;
          const text = extractMessageText(raw);
          if (text) {
            streamedAssistant += text;
            yield sseEvent({ event: "assistantResponse", data: text });
          }
        } else if (isRootChainEnd) {
          const fromOutput = extractLastAssistantText(
            event.data?.output?.messages,
          );
          assistantMessage = fromOutput || streamedAssistant;

          if (currentThreadId && !assistantPersisted) {
            const saved = await persistAssistantMessage({
              threadId: currentThreadId,
              assistantMessage,
              agentId: activeAgent.id,
              agentName: activeAgent.name,
            });
            assistantPersisted = saved;
            if (saved) {
              await touchLastAgent(currentThreadId, activeAgent.id);
            } else {
              console.error(
                "[streamConversation] failed to persist assistant message",
                { threadId: currentThreadId },
              );
            }
          }

          yield sseEvent({ event: "done", data: "end" });
          return;
        } else if (event.event === "error") {
          yield sseEvent({
            event: "error",
            data: { error: event.data ?? "unknown error" },
          });
          return;
        }
      }

      // Stream ended without a root on_chain_end — still persist what we streamed.
      if (currentThreadId && !assistantPersisted && streamedAssistant) {
        assistantMessage = streamedAssistant;
        assistantPersisted = await persistAssistantMessage({
          threadId: currentThreadId,
          assistantMessage,
          agentId: activeAgent.id,
          agentName: activeAgent.name,
        });
        if (assistantPersisted) {
          await touchLastAgent(currentThreadId, activeAgent.id);
        }
      }
      yield sseEvent({ event: "done", data: "end" });
    } finally {
      // Client abort / generator cancel: keep any partial assistant reply.
      if (
        currentThreadId &&
        !assistantPersisted &&
        streamedAssistant.trim().length > 0
      ) {
        await persistAssistantMessage({
          threadId: currentThreadId,
          assistantMessage: streamedAssistant,
          agentId: activeAgent.id,
          agentName: activeAgent.name,
        });
        assistantPersisted = true;
        await touchLastAgent(currentThreadId, activeAgent.id);
      }
      // Ensure user row exists even if we somehow skipped the early write.
      if (currentThreadId && !userPersisted) {
        await persistUserMessage({
          threadId: currentThreadId,
          userInput,
        });
      }
    }
  } catch (error) {
    yield sseEvent({
      event: "error",
      data: { error: error instanceof Error ? error.message : "Internal server error" },
    });
  }
}
