/**
 * Provider COGS metering + product entitlement counters.
 *
 * COGS → usage_events (models / tools)
 * Quotas → product_usage_events (conversation_turn / proactive_refresh)
 *
 * Subscriptions/customer charges live elsewhere. Evently is not used here.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, usageEvents, productUsageEvents } from "@neylonai/database";
import {
  getModelPrice,
  getToolPrice,
  modelCostMicros,
  toolCostMicros,
} from "./pricing";

export type ProductMetric = "conversation_turn" | "proactive_refresh";

export interface UsageAttribution {
  organizationId: string;
  requestId: string;
  apiKeyId?: string | null;
  threadId?: string | null;
  agentId?: string | null;
}

export interface RecordModelUsageInput extends UsageAttribution {
  modelId: string;
  inputTokens: number;
  outputTokens?: number;
  /** Skip price book (e.g. estimated / missing token counts). */
  forceUnknownPricing?: boolean;
  /** Selects audio vs text input rates when the price book differs. */
  inputModality?: "text" | "audio";
  metadata?: Record<string, unknown>;
}

export interface RecordToolUsageInput extends UsageAttribution {
  toolId: string;
  operation: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface RecordProductUsageInput {
  organizationId: string;
  metric: ProductMetric;
  apiKeyId?: string | null;
  requestId?: string | null;
  threadId?: string | null;
  metadata?: Record<string, unknown>;
}

function requireOrgAndRequest(input: UsageAttribution): void {
  if (!input.organizationId?.trim()) {
    throw new Error("organizationId is required for usage metering");
  }
  if (!input.requestId?.trim()) {
    throw new Error("requestId is required for usage metering");
  }
}

export async function recordModelUsage(
  input: RecordModelUsageInput,
): Promise<void> {
  requireOrgAndRequest(input);
  const inputTokens = Math.max(0, Math.floor(input.inputTokens));
  const outputTokens = Math.max(0, Math.floor(input.outputTokens ?? 0));
  const entry = getModelPrice(input.modelId);
  const priced = input.forceUnknownPricing
    ? { costMicros: null as number | null, pricingStatus: "unknown" as const }
    : modelCostMicros({
        modelId: input.modelId,
        inputTokens,
        outputTokens,
        inputModality: input.inputModality,
      });

  await db.insert(usageEvents).values({
    organization_id: input.organizationId,
    api_key_id: input.apiKeyId ?? null,
    request_id: input.requestId,
    thread_id: input.threadId ?? null,
    agent_id: input.agentId ?? null,
    resource_type: "model",
    provider: entry?.provider ?? "unknown",
    service: input.modelId,
    operation: null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    quantity: "0",
    unit: "tokens",
    provider_cost_micros: priced.costMicros,
    pricing_status: priced.pricingStatus,
    metadata: {
      modelType: entry?.type ?? "unknown",
      ...(input.inputModality ? { inputModality: input.inputModality } : {}),
      ...(entry && !input.forceUnknownPricing
        ? { pricingSource: entry.source, pricingAsOf: entry.asOf }
        : {}),
      ...(input.metadata ?? {}),
    },
  });
}

export async function recordToolUsage(
  input: RecordToolUsageInput,
): Promise<void> {
  requireOrgAndRequest(input);
  const entry = getToolPrice(input.toolId, input.operation);
  const priced = toolCostMicros({
    toolId: input.toolId,
    operation: input.operation,
    quantity: input.quantity,
  });

  await db.insert(usageEvents).values({
    organization_id: input.organizationId,
    api_key_id: input.apiKeyId ?? null,
    request_id: input.requestId,
    thread_id: input.threadId ?? null,
    agent_id: input.agentId ?? null,
    resource_type: "tool",
    provider: entry?.provider ?? input.toolId.split(".")[0] ?? "unknown",
    service: input.toolId,
    operation: input.operation,
    input_tokens: 0,
    output_tokens: 0,
    quantity: String(priced.quantity),
    unit: priced.unit,
    provider_cost_micros: priced.costMicros,
    pricing_status: priced.pricingStatus,
    metadata: {
      ...(entry
        ? { pricingSource: entry.source, pricingAsOf: entry.asOf }
        : {}),
      ...(input.metadata ?? {}),
    },
  });
}

/** Product entitlement counter — not provider COGS. */
export async function recordProductUsage(
  input: RecordProductUsageInput,
): Promise<void> {
  if (!input.organizationId?.trim()) {
    throw new Error("organizationId is required for product usage");
  }
  await db.insert(productUsageEvents).values({
    organization_id: input.organizationId,
    api_key_id: input.apiKeyId ?? null,
    metric: input.metric,
    request_id: input.requestId ?? null,
    thread_id: input.threadId ?? null,
    metadata: input.metadata ?? {},
  });
}

export function recordModelUsageSafe(input: RecordModelUsageInput): void {
  void recordModelUsage(input).catch((err) => {
    console.warn("[usage] model record failed:", err);
  });
}

export function recordToolUsageSafe(input: RecordToolUsageInput): void {
  void recordToolUsage(input).catch((err) => {
    console.warn("[usage] tool record failed:", err);
  });
}

export function recordProductUsageSafe(input: RecordProductUsageInput): void {
  void recordProductUsage(input).catch((err) => {
    console.warn("[usage] product record failed:", err);
  });
}

export function extractTokenUsage(response: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!response || typeof response !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const r = response as {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
    usage_metadata?: {
      input_tokens?: number;
      output_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
    };
    response_metadata?: {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      };
      tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
      };
    };
  };

  // @google/generative-ai GenerateContentResponse
  const geminiUm = r.usageMetadata;
  if (geminiUm) {
    const input = Number(geminiUm.promptTokenCount ?? 0) || 0;
    const output = Number(geminiUm.candidatesTokenCount ?? 0) || 0;
    if (input > 0 || output > 0) {
      return { inputTokens: input, outputTokens: output };
    }
  }

  const um = r.usage_metadata;
  if (um) {
    return {
      inputTokens: Number(um.input_tokens ?? um.prompt_tokens ?? 0) || 0,
      outputTokens: Number(um.output_tokens ?? um.completion_tokens ?? 0) || 0,
    };
  }
  const usage = r.response_metadata?.usage;
  if (usage) {
    return {
      inputTokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0,
      outputTokens:
        Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0,
    };
  }
  const tu = r.response_metadata?.tokenUsage;
  if (tu) {
    return {
      inputTokens: Number(tu.promptTokens ?? 0) || 0,
      outputTokens: Number(tu.completionTokens ?? 0) || 0,
    };
  }
  return { inputTokens: 0, outputTokens: 0 };
}

export async function getOrgUsageSummary(
  organizationId: string,
  since: Date,
) {
  const rows = await db
    .select({
      provider: usageEvents.provider,
      service: usageEvents.service,
      resourceType: usageEvents.resource_type,
      events: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${usageEvents.input_tokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${usageEvents.output_tokens}), 0)::int`,
      quantity: sql<string>`coalesce(sum(${usageEvents.quantity}), 0)::text`,
      costMicros: sql<number>`coalesce(sum(${usageEvents.provider_cost_micros}), 0)`,
      unknownPricing: sql<number>`count(*) filter (where ${usageEvents.pricing_status} = 'unknown')::int`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organization_id, organizationId),
        gte(usageEvents.created_at, since),
      ),
    )
    .groupBy(
      usageEvents.provider,
      usageEvents.service,
      usageEvents.resource_type,
    );

  let totalCostMicros = 0;
  let modelEvents = 0;
  let toolEvents = 0;
  let embeddingEvents = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let unknownPricingEvents = 0;

  const byService = rows.map((r) => {
    const cost = Number(r.costMicros);
    totalCostMicros += cost;
    const events = Number(r.events);
    const inTok = Number(r.inputTokens);
    const outTok = Number(r.outputTokens);
    inputTokens += inTok;
    outputTokens += outTok;
    unknownPricingEvents += Number(r.unknownPricing);
    if (r.resourceType === "tool") toolEvents += events;
    else if (r.service.includes("embedding")) embeddingEvents += events;
    else modelEvents += events;
    return {
      provider: r.provider,
      service: r.service,
      resourceType: r.resourceType,
      events,
      inputTokens: inTok,
      outputTokens: outTok,
      quantity: Number(r.quantity),
      costMicros: cost,
      unknownPricingEvents: Number(r.unknownPricing),
    };
  });

  return {
    since: since.toISOString(),
    byService,
    totalCostMicros,
    unknownPricingEvents,
    modelEvents,
    toolEvents,
    embeddingEvents,
    inputTokens,
    outputTokens,
  };
}

export async function listRecentUsage(
  organizationId: string,
  limit = 50,
) {
  return db
    .select({
      id: usageEvents.id,
      requestId: usageEvents.request_id,
      resourceType: usageEvents.resource_type,
      provider: usageEvents.provider,
      service: usageEvents.service,
      operation: usageEvents.operation,
      inputTokens: usageEvents.input_tokens,
      outputTokens: usageEvents.output_tokens,
      quantity: usageEvents.quantity,
      unit: usageEvents.unit,
      providerCostMicros: usageEvents.provider_cost_micros,
      pricingStatus: usageEvents.pricing_status,
      agentId: usageEvents.agent_id,
      createdAt: usageEvents.created_at,
    })
    .from(usageEvents)
    .where(eq(usageEvents.organization_id, organizationId))
    .orderBy(desc(usageEvents.created_at))
    .limit(limit);
}

export async function countProductMetric(
  organizationId: string,
  metric: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productUsageEvents)
    .where(
      and(
        eq(productUsageEvents.organization_id, organizationId),
        eq(productUsageEvents.metric, metric),
        gte(productUsageEvents.created_at, since),
      ),
    );
  return Number(row?.n ?? 0);
}

export type UsageTrendPoint = {
  date: string;
  conversations: number;
  events: number;
};

export async function getUsageTrendForOrg(
  organizationId: string,
  days: number,
): Promise<UsageTrendPoint[]> {
  const safeDays = Math.min(Math.max(days, 1), 90);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (safeDays - 1));

  const rows = await db
    .select({
      day: sql<string>`to_char((${productUsageEvents.created_at} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      conversations: sql<number>`count(*) filter (where ${productUsageEvents.metric} = 'conversation_turn')::int`,
      events: sql<number>`count(*)::int`,
    })
    .from(productUsageEvents)
    .where(
      and(
        eq(productUsageEvents.organization_id, organizationId),
        gte(productUsageEvents.created_at, since),
      ),
    )
    .groupBy(
      sql`to_char((${productUsageEvents.created_at} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
    )
    .orderBy(
      sql`to_char((${productUsageEvents.created_at} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
    );

  const byDay = new Map(
    rows.map((r) => [
      r.day,
      {
        conversations: Number(r.conversations),
        events: Number(r.events),
      },
    ]),
  );

  const points: UsageTrendPoint[] = [];
  for (let i = 0; i < safeDays; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    points.push({
      date: key,
      conversations: hit?.conversations ?? 0,
      events: hit?.events ?? 0,
    });
  }
  return points;
}

export async function getPlatformUsageSnapshot(since: Date) {
  const [agg] = await db
    .select({
      events: sql<number>`count(*)::int`,
      modelEvents: sql<number>`count(*) filter (where ${usageEvents.resource_type} = 'model')::int`,
      toolEvents: sql<number>`count(*) filter (where ${usageEvents.resource_type} = 'tool')::int`,
      costMicros: sql<number>`coalesce(sum(${usageEvents.provider_cost_micros}), 0)`,
      inputTokens: sql<number>`coalesce(sum(${usageEvents.input_tokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${usageEvents.output_tokens}), 0)::int`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.created_at, since));

  const [product] = await db
    .select({
      conversations: sql<number>`count(*) filter (where ${productUsageEvents.metric} = 'conversation_turn')::int`,
      proactive: sql<number>`count(*) filter (where ${productUsageEvents.metric} = 'proactive_refresh')::int`,
    })
    .from(productUsageEvents)
    .where(gte(productUsageEvents.created_at, since));

  return {
    since: since.toISOString(),
    events: Number(agg?.events ?? 0),
    modelEvents: Number(agg?.modelEvents ?? 0),
    toolEvents: Number(agg?.toolEvents ?? 0),
    conversations: Number(product?.conversations ?? 0),
    proactive: Number(product?.proactive ?? 0),
    costMicros: Number(agg?.costMicros ?? 0),
    inputTokens: Number(agg?.inputTokens ?? 0),
    outputTokens: Number(agg?.outputTokens ?? 0),
  };
}

export {
  MODEL_PRICE_BOOK,
  TOOL_PRICE_BOOK,
  modelCostMicros,
  toolCostMicros,
  getModelPrice,
} from "./pricing";
