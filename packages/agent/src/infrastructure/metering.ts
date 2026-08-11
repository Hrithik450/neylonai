import {
  extractTokenUsage,
  recordModelUsageSafe,
  recordToolUsageSafe,
} from "@neylonai/domain/billing";
import { getAgentTurnContext } from "./agent-turn-context";

type Attr = {
  organizationId?: string;
  requestId?: string;
  apiKeyId?: string | null;
  threadId?: string | null;
  agentId?: string | null;
};

function attribution(extras?: Attr) {
  const turn = getAgentTurnContext();
  const organizationId = extras?.organizationId ?? turn.organizationId;
  const requestId = extras?.requestId ?? turn.requestId;
  if (!organizationId || !requestId) return null;
  return {
    organizationId,
    requestId,
    apiKeyId: extras?.apiKeyId ?? turn.apiKeyId ?? null,
    threadId: extras?.threadId ?? turn.threadId ?? null,
    agentId: extras?.agentId ?? turn.agentId ?? null,
  };
}

/** Record model COGS from a LangChain/Gemini response. No-ops without attribution. */
export function meterModelResponse(
  modelId: string,
  response: unknown,
  extras?: Attr & {
    metadata?: Record<string, unknown>;
    /** Override tokens extracted from `response`. */
    inputTokens?: number;
    outputTokens?: number;
    /** Skip price book (estimated / missing counts). */
    forceUnknownPricing?: boolean;
    inputModality?: "text" | "audio";
  },
): void {
  const attr = attribution(extras);
  if (!attr) return;
  const tokens = extractTokenUsage(response);
  const inputTokens = extras?.inputTokens ?? tokens.inputTokens;
  const outputTokens = extras?.outputTokens ?? tokens.outputTokens;
  const missing = inputTokens === 0 && outputTokens === 0;
  recordModelUsageSafe({
    ...attr,
    modelId,
    inputTokens,
    outputTokens,
    inputModality: extras?.inputModality,
    forceUnknownPricing: extras?.forceUnknownPricing ?? missing,
    metadata: {
      ...(missing && !extras?.forceUnknownPricing
        ? { note: "Provider response omitted token usage" }
        : {}),
      ...(extras?.metadata ?? {}),
    },
  });
}

/** Char/4 estimate when provider omits embedding token counts — cost stays unknown. */
export function meterEmbeddingUsage(
  modelId: string,
  texts: string[],
  extras?: Attr & {
    metadata?: Record<string, unknown>;
    inputTokens?: number;
    tokensMeasured?: boolean;
  },
): void {
  const attr = attribution(extras);
  if (!attr) return;
  const measured = extras?.tokensMeasured === true;
  const chars = texts.reduce((n, t) => n + t.length, 0);
  recordModelUsageSafe({
    ...attr,
    modelId,
    inputTokens: measured
      ? Math.max(0, extras?.inputTokens ?? 0)
      : Math.max(1, Math.ceil(chars / 4)),
    outputTokens: 0,
    forceUnknownPricing: !measured,
    metadata: {
      embeddingTexts: texts.length,
      tokenSource: measured ? "provider" : "char_estimate",
      ...(extras?.metadata ?? {}),
    },
  });
}

export function meterToolUsage(
  toolId: string,
  operation: string,
  extras?: Attr & {
    quantity?: number;
    metadata?: Record<string, unknown>;
  },
): void {
  const attr = attribution(extras);
  if (!attr) return;
  recordToolUsageSafe({
    ...attr,
    toolId,
    operation,
    quantity: extras?.quantity,
    metadata: extras?.metadata,
  });
}
