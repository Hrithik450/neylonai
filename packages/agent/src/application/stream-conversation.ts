import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { randomUUID } from "node:crypto";
import { ThreadsService, ThreadMessagesService } from "@neylonai/domain/chat";
import { generateThreadTitle } from "../lib/generate-thread-title";
import {
  canAiRespond,
  escalateConversation,
  getConversationStatus,
} from "@neylonai/domain/conversations";
import { resolveKnowledgeScope } from "@neylonai/database";
import { getAgent, getDefaultAgent } from "../domain/registry";
import type { AgentDefinition, StreamConversationInput } from "../domain/types";
import {
  getTurnBillingSignals,
  patchAgentTurnContext,
  recordCreditEstimate,
  recordRoutedModel,
  takeProvenanceHits,
  withAgentTurnContext,
} from "../infrastructure/agent-turn-context";
import { finalizeAssistantEngagement } from "@neylonai/domain/engagement";
import { buildAgentGraph } from "./build-agent-graph";
import { reframeQuery } from "./reframe-query";
import { routeModel, toTurnCreditEstimate, applyAffordabilityToRoute } from "./model-router";
import { buildHeuristicTips, startThinkingTipsRefresh } from "./thinking-tips";
import { buildHandoffSummary, detectEscalation } from "./escalation";
import {
  loadOrgCapabilities,
  resolveAgentTools,
  toolNamesKey,
  type OrgCapabilitySnapshot,
} from "./resolve-agent-tools";
import { getTodayDate } from "../lib/date";

async function finalizeTurnCredits(input: {
  organizationId?: string | null;
  requestId?: string | null;
  apiKeyId?: string | null;
  threadId?: string | null;
  agentId?: string | null;
  delivered?: boolean;
}): Promise<void> {
  if (!input.organizationId || !input.requestId) return;
  try {
    const { finalizeAiCreditRequest } =
      await import("@neylonai/domain/billing");
    const signals = getTurnBillingSignals();
    await finalizeAiCreditRequest({
      organizationId: input.organizationId,
      requestId: input.requestId,
      apiKeyId: input.apiKeyId,
      threadId: input.threadId,
      agentId: input.agentId,
      delivered: Boolean(input.delivered),
      signals: {
        complexityTier: signals.complexityTier ?? null,
        routeSource: signals.routeSource ?? null,
        routedModel: signals.routedModel ?? null,
        agentRounds: signals.agentRounds,
        toolsUsed: signals.toolsUsed,
        semanticSearchCount: signals.semanticSearchCount,
        ragTokens: signals.ragTokens,
        databaseRows: signals.databaseRows,
        capped: signals.capped,
        capReason: signals.capReason ?? null,
        estimate: signals.estimate ?? null,
        workloadClass: signals.workloadClass ?? null,
        requestedClass: signals.estimate?.requestedClass ?? null,
        downgradedFrom: signals.estimate?.downgradedFrom ?? null,
        billingMode: signals.estimate?.billingMode ?? null,
      },
    });
  } catch (error) {
    console.warn(
      "[streamConversation] credit finalize failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

function sseEvent(payload: object): string {
  return "data: " + JSON.stringify(payload) + "\n\n";
}

function tipEvent(tips: string[], source: "heuristic" | "llm"): string {
  return sseEvent({
    event: "thinkingTips",
    data: { tips, source, thinking: "true" },
  });
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
      kind === "ai" || kind === "assistant" || msg instanceof AIMessage;

    if (!isAssistant && kind) continue;

    const text = extractMessageText(typed.content);
    if (text) return text;
    if (isAssistant) return "";
  }

  return "";
}

async function persistUserMessage(input: {
  id?: string;
  threadId: string;
  userInput: string;
  pagePath?: string | null;
  pageQuery?: Record<string, string>;
}): Promise<boolean> {
  const userResult = await ThreadMessagesService.createMessage({
    id: input.id,
    thread_id: input.threadId,
    role: "user",
    content: input.userInput,
    page_path: input.pagePath ?? null,
    page_query: input.pageQuery ?? {},
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
  id?: string;
  threadId: string;
  assistantMessage: string;
  inReplyToMessageId?: string | null;
  organizationId?: string | null;
  userQuestion?: string;
  pagePath?: string | null;
  requestId?: string | null;
}): Promise<boolean> {
  if (!input.assistantMessage.trim()) return true;

  const assistantResult = await ThreadMessagesService.createMessage({
    id: input.id,
    thread_id: input.threadId,
    role: "assistant",
    content: input.assistantMessage,
    in_reply_to_message_id: input.inReplyToMessageId ?? null,
  });

  if (!assistantResult.success) {
    console.error(
      "[streamConversation] assistant message persist failed:",
      assistantResult.error,
    );
    return false;
  }

  if (input.organizationId && input.id) {
    try {
      await finalizeAssistantEngagement({
        organizationId: input.organizationId,
        threadId: input.threadId,
        assistantMessageId: input.id,
        userQuestion: input.userQuestion ?? "",
        pagePath: input.pagePath,
        requestId: input.requestId,
        provenanceHits: takeProvenanceHits(),
      });
    } catch (error) {
      console.warn(
        "[streamConversation] engagement finalize failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return true;
}

const GRAPH_CACHE_MAX = 32;
const graphCache = new Map<string, ReturnType<typeof buildAgentGraph>>();

function getOrCreateGraph(
  cacheKey: string,
  tools: AgentDefinition["tools"],
  model: string,
  budgets: { maxToolRounds: number; maxToolCalls: number },
) {
  const existing = graphCache.get(cacheKey);
  if (existing) {
    graphCache.delete(cacheKey);
    graphCache.set(cacheKey, existing);
    return existing;
  }

  const graph = buildAgentGraph(tools, {
    model,
    maxToolRounds: budgets.maxToolRounds,
    maxToolCalls: budgets.maxToolCalls,
  });
  graphCache.set(cacheKey, graph);
  while (graphCache.size > GRAPH_CACHE_MAX) {
    const oldest = graphCache.keys().next().value;
    if (oldest === undefined) break;
    graphCache.delete(oldest);
  }
  return graph;
}

function buildAgentState(
  systemPrompt: string,
  effectiveInput: string,
  conversationHistory: Array<{ role: string; content: string }>,
  pagePath?: string | null,
  pageQuery?: Record<string, string>,
) {
  // Gemini requires a single system message and it must be first.
  // Fold page context into that message instead of appending another SystemMessage.
  let systemContent = systemPrompt.replace("{today_date}", getTodayDate());
  if (pagePath) {
    systemContent = [
      systemContent,
      "",
      "Current visitor page context:",
      `- canonical path: ${pagePath}`,
      ...(pageQuery && Object.keys(pageQuery).length > 0
        ? [`- query metadata: ${JSON.stringify(pageQuery)}`]
        : []),
      "Use this only to understand intent and prefer knowledge retrieved from this page.",
      "Do not claim to have read live page content; rely on the knowledge search tool.",
    ].join("\n");
  }

  const messages: BaseMessage[] = [new SystemMessage(systemContent)];

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

function fallbackThreadTitle(userInput: string): string {
  const trimmed = userInput.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New Chat";
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`;
}

async function createThread(
  organizationId: string,
  participantId: string,
  userInput: string,
) {
  const title = fallbackThreadTitle(userInput);
  const result = await ThreadsService.createThread({
    organization_id: organizationId,
    participant_id: participantId,
    title,
  });
  if (!result.success || !result.data) return null;

  // Title polish is nice-to-have — don't block the first answer on it.
  void generateThreadTitle(userInput)
    .then(async (generated) => {
      if (!generated || generated === title || !result.data?.id) return;
      await ThreadsService.updateThread(result.data.id, { title: generated });
    })
    .catch(() => {
      // Keep the fallback title.
    });

  return result.data;
}

/**
 * Streams a conversation turn for a registered agent.
 * Yields delimited JSON event strings compatible with the existing SSE-like protocol.
 */
export async function* streamConversation(
  input: StreamConversationInput,
): AsyncGenerator<string> {
  const agent = input.agentId ? getAgent(input.agentId) : getDefaultAgent();
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
      pagePath: input.pagePath ?? undefined,
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
    organizationId,
    participantId,
    participantExternalId,
    participantAnonymous,
    participantName,
    participantEmail,
    pagePath,
    pageQuery,
    conversationHistory,
  } = input;

  let currentThreadId = threadId;
  /** Agent that will author the assistant turn (may hand off mid-flow). */
  let activeAgent = agent;
  let deliveredResponse = false;

  try {
    const caps: OrgCapabilitySnapshot = await loadOrgCapabilities(
      organizationId ?? null,
    );

    if (organizationId) {
      await bindKnowledgeScopeToTurn(organizationId);
    }

    if (organizationId && participantId && !currentThreadId) {
      const thread = await createThread(
        organizationId,
        participantId,
        userInput,
      );
      if (thread) {
        currentThreadId = thread.id;
        patchAgentTurnContext({ threadId: currentThreadId });
        yield sseEvent({ event: "threadCreated", data: thread });
      }
    }

    // Persist the human turn immediately so interrupt/follow-up never drops it.
    let userPersisted = false;
    let assistantPersisted = false;
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const engagementContext = {
      organizationId: organizationId ?? null,
      userQuestion: userInput,
      pagePath: pagePath ?? null,
      requestId: input.requestId ?? null,
    };
    if (currentThreadId) {
      userPersisted = await persistUserMessage({
        id: userMessageId,
        threadId: currentThreadId,
        userInput,
        pagePath,
        pageQuery,
      });
    }

    if (organizationId && currentThreadId) {
      if (participantExternalId) {
        await ThreadsService.invalidateParticipantThreadCaches(
          participantExternalId,
          organizationId,
        );
      }

      const conversationStatus = await getConversationStatus(currentThreadId);
      if (!canAiRespond(conversationStatus)) {
        // Visitor message is persisted; AI must not respond while escalated.
        yield sseEvent({
          event: "conversationEscalated",
          data: { escalated: true },
        });
        yield sseEvent({ event: "done", data: "end" });
        return;
      }

      const decision = detectEscalation(userInput, conversationHistory);
      if (decision.shouldEscalate && decision.trigger && decision.reason) {
        const summary = buildHandoffSummary(conversationHistory, userInput);
        const result = await escalateConversation({
          organizationId,
          threadId: currentThreadId,
          reason: decision.reason,
          trigger: decision.trigger,
          summary,
        });

        assistantPersisted = await persistAssistantMessage({
          id: assistantMessageId,
          threadId: currentThreadId,
          assistantMessage: result.customerMessage,
          inReplyToMessageId: userMessageId,
          ...engagementContext,
        });
        deliveredResponse = true;

        yield sseEvent({
          event: "assistantResponse",
          data: result.customerMessage,
        });

        yield sseEvent({
          event: result.contactRequired
            ? "handoffContactRequired"
            : "conversationEscalated",
          data: {
            escalated: result.escalated,
            status: result.status,
            threadId: currentThreadId,
          },
        });

        if (assistantPersisted) {
          yield sseEvent({
            event: "messagePersisted",
            data: { userMessageId, assistantMessageId },
          });
        }

        yield sseEvent({ event: "done", data: "end" });
        return;
      }
    }

    await activeAgent.onTurnStart?.({
      threadId: currentThreadId ?? undefined,
      participantExternalId: participantExternalId ?? undefined,
      organizationId: organizationId ?? undefined,
      userInput,
    });

    // Instant tips so the UI never sits on a blank spinner.
    const heuristicTips = buildHeuristicTips(userInput);
    yield tipEvent(heuristicTips.tips, "heuristic");

    // LLM tip refresh runs in parallel with reframe + routing (hard timeout inside).
    const tipsRefresh = startThinkingTipsRefresh(userInput);

    const {
      emptyOrgWorkloadSummary,
      getOrgWorkloadSummary,
      snapshotConversationWorkload,
      toolCostMetadata,
      assertCanStartAiTurn,
      reserveCreditsForRequest,
      getWorkloadBudget,
      getSubscriptionForOrg,
      buildUsageUpgradePrompt,
      normalizePlanId,
      ApiAuthError,
    } = await import("@neylonai/domain/billing");

    const tools = resolveAgentTools(activeAgent, caps);
    const toolNames = tools.map((tool) =>
      typeof (tool as { name?: string }).name === "string"
        ? (tool as { name: string }).name
        : "",
    ).filter(Boolean);

    const [reframeResult, workload] = await Promise.all([
      conversationHistory.length > 0
        ? reframeQuery(userInput, conversationHistory)
        : Promise.resolve(null),
      organizationId
        ? getOrgWorkloadSummary(organizationId)
        : Promise.resolve(emptyOrgWorkloadSummary()),
    ]);

    let effectiveInput = userInput;
    if (reframeResult) {
      effectiveInput = reframeResult.optimized_query ?? userInput;
      console.log(
        `[memory] is_followup=${reframeResult.is_followup} | optimized: "${effectiveInput}"`,
      );
    }

    if (organizationId) {
      patchAgentTurnContext({ knowledgeChunkCount: workload.chunkCount });
    }

    const conversation = snapshotConversationWorkload(
      conversationHistory,
      effectiveInput,
    );

    const creditExhaustionEvent = async (error: unknown) => {
      const message =
        error instanceof ApiAuthError || error instanceof Error
          ? error.message
          : "Usage limit reached";
      const code =
        error instanceof ApiAuthError ? error.code : "usage_exceeded";
      let upgrade:
        | {
            title: string;
            detail: string;
            ctaLabel: string;
            href: string;
            targetPlanId: string;
          }
        | undefined;
      if (organizationId) {
        try {
          const sub = await getSubscriptionForOrg(organizationId);
          const prompt = buildUsageUpgradePrompt(normalizePlanId(sub?.plan), {
            used: 1,
            limit: 1,
            metricLabel: "included AI credits",
          });
          if (prompt) {
            upgrade = {
              title: prompt.title,
              detail: prompt.detail,
              ctaLabel: prompt.ctaLabel,
              href: prompt.href,
              targetPlanId: prompt.targetPlanId,
            };
          }
        } catch {
          // best-effort upgrade CTA
        }
      }
      return {
        event: "error" as const,
        data: {
          error: message,
          code,
          blocked: "credits" as const,
          ...(upgrade ? { upgrade } : {}),
        },
      };
    };

    if (organizationId) {
      try {
        await assertCanStartAiTurn(organizationId);
      } catch (error) {
        yield sseEvent(await creditExhaustionEvent(error));
        yield sseEvent({ event: "done", data: "end" });
        return;
      }
    }

    let route = await routeModel({
      question: effectiveInput,
      availableTools: toolCostMetadata(toolNames),
      workload,
      conversation,
    });

    if (organizationId && input.requestId && route.billable) {
      try {
        const reserved = await reserveCreditsForRequest({
          organizationId,
          requestId: input.requestId,
          requestedClass: route.workloadClass,
          billable: route.billable,
        });
        route = applyAffordabilityToRoute(route, {
          requestedClass: reserved.decision.requestedClass,
          effectiveClass: reserved.decision.effectiveClass,
          downgradedFrom: reserved.decision.downgradedFrom,
          billingMode: reserved.decision.billingMode,
          reason: reserved.decision.reason,
        });
      } catch (error) {
        yield sseEvent(await creditExhaustionEvent(error));
        yield sseEvent({ event: "done", data: "end" });
        return;
      }
    }

    recordRoutedModel({
      model: route.model,
      complexity: route.complexity,
      source: route.source,
      workloadClass: route.workloadClass,
    });
    recordCreditEstimate(toTurnCreditEstimate(route));
    console.log(
      `[model-router] requested=${route.requestedClass ?? route.workloadClass} effective=${route.workloadClass} billable=${route.billable} billingMode=${route.billingMode ?? "included"} complexity=${route.complexity} model=${route.model} source=${route.source} credits=${route.estimatedCredits}${route.downgradedFrom ? ` downgradedFrom=${route.downgradedFrom}` : ""}`,
    );

    const upgraded = await tipsRefresh;
    if (upgraded?.tips.length) {
      yield tipEvent(upgraded.tips, "llm");
      console.log(`[thinking-tips] upgraded via llm (${upgraded.tips.length})`);
    }

    const budget = getWorkloadBudget(route.workloadClass);
    const cacheKey = `${activeAgent.id}:${route.model}:${toolNamesKey(tools)}:${route.workloadClass}`;
    const graph = getOrCreateGraph(cacheKey, tools, route.model, {
      maxToolRounds: budget.rounds,
      maxToolCalls: budget.totalToolCalls,
    });

    const agentState = buildAgentState(
      activeAgent.systemPrompt,
      effectiveInput,
      conversationHistory,
      pagePath,
      pageQuery,
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
          event.event === "on_chat_model_start" &&
          event.metadata?.langgraph_node === "agent"
        ) {
          // Only the last model round is persisted, so anything streamed by an
          // earlier one is stale: a tool-call preamble the next round restates,
          // or a partial answer from a call that failed and got a retry key.
          // Without this the widget concatenates every round and repeats itself.
          if (streamedAssistant) {
            streamedAssistant = "";
            yield sseEvent({ event: "assistantReset", data: "reset" });
          }
        } else if (
          event.event === "on_chat_model_stream" &&
          event.metadata?.langgraph_node === "agent"
        ) {
          const chunk = event.data?.chunk;
          const raw = chunk?.content;
          const text = extractMessageText(raw);
          if (text) {
            streamedAssistant += text;
            deliveredResponse = true;
            yield sseEvent({ event: "assistantResponse", data: text });
          }
        } else if (isRootChainEnd) {
          const fromOutput = extractLastAssistantText(
            event.data?.output?.messages,
          );
          assistantMessage = fromOutput || streamedAssistant;

          // A reset cleared the widget bubble. If the final round answered
          // without emitting token chunks, send the answer once so the client
          // isn't left showing nothing.
          if (assistantMessage && !streamedAssistant) {
            deliveredResponse = true;
            yield sseEvent({
              event: "assistantResponse",
              data: assistantMessage,
            });
          }

          if (currentThreadId && !assistantPersisted) {
            const saved = await persistAssistantMessage({
              id: assistantMessageId,
              threadId: currentThreadId,
              assistantMessage,
              inReplyToMessageId: userMessageId,
              ...engagementContext,
            });
            assistantPersisted = saved;
            if (saved) {
              deliveredResponse = true;
            } else {
              console.error(
                "[streamConversation] failed to persist assistant message",
                { threadId: currentThreadId },
              );
            }
          }

          const billingSignals = getTurnBillingSignals();
          if (
            billingSignals.capped &&
            route.workloadClass === "complex" &&
            organizationId &&
            currentThreadId
          ) {
            const summary = buildHandoffSummary(conversationHistory, userInput);
            const result = await escalateConversation({
              organizationId,
              threadId: currentThreadId,
              reason: "Complex workload budget exhausted",
              trigger: "business_rule",
              summary,
            });
            yield sseEvent({
              event: result.contactRequired
                ? "handoffContactRequired"
                : "conversationEscalated",
              data: {
                escalated: result.escalated,
                status: result.status,
                threadId: currentThreadId,
              },
            });
          }

          if (currentThreadId) {
            const finalStatus = await getConversationStatus(currentThreadId);
            if (finalStatus === "awaiting_contact") {
              yield sseEvent({
                event: "handoffContactRequired",
                data: {
                  escalated: false,
                  status: finalStatus,
                  threadId: currentThreadId,
                },
              });
            } else if (
              finalStatus === "human_pending" ||
              finalStatus === "human_active"
            ) {
              yield sseEvent({
                event: "conversationEscalated",
                data: { escalated: true, status: finalStatus },
              });
            }
          }
          if (assistantPersisted) {
            yield sseEvent({
              event: "messagePersisted",
              data: { userMessageId, assistantMessageId },
            });
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
          id: assistantMessageId,
          threadId: currentThreadId,
          assistantMessage,
          inReplyToMessageId: userMessageId,
          ...engagementContext,
        });
      }
      if (assistantPersisted) {
        yield sseEvent({
          event: "messagePersisted",
          data: { userMessageId, assistantMessageId },
        });
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
          id: assistantMessageId,
          threadId: currentThreadId,
          assistantMessage: streamedAssistant,
          inReplyToMessageId: userMessageId,
          ...engagementContext,
        });
        assistantPersisted = true;
        deliveredResponse = true;
      }
      // Ensure user row exists even if we somehow skipped the early write.
      if (currentThreadId && !userPersisted) {
        await persistUserMessage({
          id: userMessageId,
          threadId: currentThreadId,
          userInput,
          pagePath,
          pageQuery,
        });
      }
    }
  } catch (error) {
    yield sseEvent({
      event: "error",
      data: {
        error: error instanceof Error ? error.message : "Internal server error",
      },
    });
  } finally {
    await finalizeTurnCredits({
      organizationId,
      requestId: input.requestId,
      apiKeyId: input.apiKeyId,
      threadId: currentThreadId,
      agentId: activeAgent.id,
      delivered: deliveredResponse,
    });
  }
}
