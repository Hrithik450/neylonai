import { GoogleGenerativeAI } from "@google/generative-ai";
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
import type { StreamConversationInput } from "../domain/types";
import {
  getTurnBillingSignals,
  patchAgentTurnContext,
  recordCreditEstimate,
  recordRoutedModel,
  takeProvenanceHits,
  withAgentTurnContext,
} from "../infrastructure/agent-turn-context";
import { finalizeAssistantEngagement } from "@neylonai/domain/engagement";
import { reframeQuery } from "./reframe-query";
import { routeModel, toTurnCreditEstimate, applyAffordabilityToRoute } from "./model-router";
import { buildHeuristicTips, startThinkingTipsRefresh } from "./thinking-tips";
import { buildHandoffSummary, detectEscalation } from "./escalation";
import { getTodayDate } from "../lib/date";
import {
  resolvePageSectionContext,
  type ResolvedPageSectionContext,
} from "./resolve-page-section-context";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";

function sseEvent(payload: object): string {
  return "data: " + JSON.stringify(payload) + "\n\n";
}

function tipEvent(tips: string[], source: "heuristic" | "llm"): string {
  return sseEvent({
    event: "thinkingTips",
    data: { tips, source, thinking: "true" },
  });
}

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
    const { finalizeAiCreditRequest } = await import("@neylonai/domain/billing");
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

async function createThread(
  organizationId: string,
  participantId: string,
  userInput: string,
) {
  const title = await generateThreadTitle(userInput);
  const result = await ThreadsService.createThread({
    organization_id: organizationId,
    participant_id: participantId,
    title,
  });
  if (!result.success || !result.data) return null;

  return result.data;
}

function buildSystemPrompt(
  basePrompt: string,
  pagePath?: string | null,
  pageQuery?: Record<string, string>,
  pageSection?: StreamConversationInput["pageSection"],
  resolvedPageSection?: ResolvedPageSectionContext | null,
): string {
  let systemContent = basePrompt.replace("{today_date}", getTodayDate());

  if (pagePath) {
    systemContent = [
      systemContent,
      "",
      "Current visitor page context:",
      `- canonical path: ${pagePath}`,
      ...(pageQuery && Object.keys(pageQuery).length > 0
        ? [`- query metadata: ${JSON.stringify(pageQuery)}`]
        : []),
      "Use this only to understand intent.",
    ].join("\n");
  }

  if (pageSection) {
    systemContent = [
      systemContent,
      "",
      `Active page section: ${JSON.stringify(pageSection.sectionLabel ?? pageSection.sectionId)}`,
    ].join("\n");
  }

  if (resolvedPageSection) {
    systemContent = [
      systemContent,
      "Relevant website knowledge:",
      "<page_section_knowledge>",
      resolvedPageSection.content,
      "</page_section_knowledge>",
    ].join("\n");
  }

  return systemContent;
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

/**
 * Simplified streaming without LangGraph - direct Gemini API streaming.
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

async function* streamConversationTurn(
  input: StreamConversationInput,
  agent: any,
): AsyncGenerator<string> {
  const {
    userInput,
    threadId,
    organizationId,
    participantId,
    participantExternalId,
    pagePath,
    pageQuery,
    pageSection,
    conversationHistory,
  } = input;

  let currentThreadId = threadId;
  let deliveredResponse = false;

  try {
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

    await agent.onTurnStart?.({
      threadId: currentThreadId ?? undefined,
      participantExternalId: participantExternalId ?? undefined,
      organizationId: organizationId ?? undefined,
      userInput,
    });

    // Instant tips
    const heuristicTips = buildHeuristicTips(userInput);
    yield tipEvent(heuristicTips.tips, "heuristic");

    // LLM tip refresh
    const tipsRefresh = startThinkingTipsRefresh(userInput);

    let effectiveInput = userInput;
    if (conversationHistory.length > 0) {
      const reframed = await reframeQuery(userInput, conversationHistory);
      effectiveInput = reframed.optimized_query ?? userInput;
    }

    const {
      emptyOrgWorkloadSummary,
      getOrgWorkloadSummary,
      snapshotConversationWorkload,
      assertCanStartAiTurn,
      reserveCreditsForRequest,
      getSubscriptionForOrg,
      buildUsageUpgradePrompt,
      normalizePlanId,
      ApiAuthError,
    } = await import("@neylonai/domain/billing");

    const workload = organizationId
      ? await getOrgWorkloadSummary(organizationId)
      : emptyOrgWorkloadSummary();
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
      availableTools: [],
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

    const upgraded = await tipsRefresh;
    if (upgraded?.tips.length) {
      yield tipEvent(upgraded.tips, "llm");
    }

    const resolvedPageSection =
      organizationId && pagePath && pageSection
        ? await resolvePageSectionContext({
            organizationId,
            agentId: agent.id,
            pagePath,
            section: pageSection,
          })
        : null;

    const systemPrompt = buildSystemPrompt(
      agent.systemPrompt,
      pagePath,
      pageQuery,
      pageSection,
      resolvedPageSection,
    );

    // Build conversation history
    const contents = [];
    for (const msg of conversationHistory) {
      if (!msg.content) continue;
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: effectiveInput }],
    });

    let assistantMessage = "";

    try {
      const result = await withGoogleApiRetry(async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: route.model.replace("gemini-", "gemini-"),
        });

        const chat = model.startChat({
          history: contents.slice(0, -1),
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        });

        return chat.sendMessageStream(effectiveInput);
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          assistantMessage += text;
          deliveredResponse = true;
          yield sseEvent({ event: "assistantResponse", data: text });
        }
      }

      if (currentThreadId && !assistantPersisted) {
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
    } catch (error) {
      yield sseEvent({
        event: "error",
        data: {
          error: error instanceof Error ? error.message : "Streaming error",
        },
      });
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
      agentId: agent.id,
      delivered: deliveredResponse,
    });
  }
}
