/**
 * Provider price books for COGS.
 * Update rates here only — never hardcode elsewhere.
 *
 * Gemini (Standard paid tier): https://ai.google.dev/gemini-api/docs/pricing
 * Tavily: https://docs.tavily.com/documentation/api-credits
 * Firecrawl: https://www.firecrawl.dev/pricing
 * Jina Reader: https://jina.ai/reader
 * Verified: 2026-08-11
 *
 * Unknown / unverified models & tools → cost null. Never invent rates.
 * Audio input can differ from text input on the same model — use
 * `audioInputUsdPer1M` when metering audio (e.g. STT).
 */

export type PricingStatus = "verified" | "unknown";

export interface ModelPrice {
  provider: "google";
  modelId: string;
  type: "llm" | "embedding";
  inputUsdPer1M?: number;
  /** When set, audio input tokens use this rate instead of `inputUsdPer1M`. */
  audioInputUsdPer1M?: number;
  outputUsdPer1M?: number;
  embeddingDimensions?: number;
  pricingStatus: PricingStatus;
  source: string;
  asOf: string;
}

export interface ToolPrice {
  provider: string;
  toolId: string;
  operation: string;
  unit: string;
  unitsPerOperation: number;
  usdPerUnit?: number;
  pricingStatus: PricingStatus;
  source: string;
  asOf: string;
}

const GEMINI_SRC = "https://ai.google.dev/gemini-api/docs/pricing";
const TAVILY_SRC = "https://docs.tavily.com/documentation/api-credits";
const FIRECRAWL_SRC = "https://www.firecrawl.dev/pricing";
const JINA_SRC = "https://jina.ai/reader";
const AS_OF = "2026-08-11";
const TAVILY_PAYG_USD = 0.008;
/** Hobby effective rate: $16 / 5,000 credits (beyond free 1,000/mo). */
const FIRECRAWL_HOBBY_USD_PER_CREDIT = 0.0032;

export const MODEL_PRICE_BOOK: Record<string, ModelPrice> = {
  "gemini-3.6-flash": {
    provider: "google",
    modelId: "gemini-3.6-flash",
    type: "llm",
    inputUsdPer1M: 1.5,
    outputUsdPer1M: 7.5,
    pricingStatus: "verified",
    source: GEMINI_SRC,
    asOf: AS_OF,
  },
  "gemini-3.5-flash": {
    provider: "google",
    modelId: "gemini-3.5-flash",
    type: "llm",
    inputUsdPer1M: 1.5,
    outputUsdPer1M: 9.0,
    pricingStatus: "verified",
    source: GEMINI_SRC,
    asOf: AS_OF,
  },
  "gemini-3.1-flash-lite": {
    provider: "google",
    modelId: "gemini-3.1-flash-lite",
    type: "llm",
    inputUsdPer1M: 0.25,
    audioInputUsdPer1M: 0.5,
    outputUsdPer1M: 1.5,
    pricingStatus: "verified",
    source: GEMINI_SRC,
    asOf: AS_OF,
  },
  "gemini-3.5-flash-lite": {
    provider: "google",
    modelId: "gemini-3.5-flash-lite",
    type: "llm",
    inputUsdPer1M: 0.3,
    audioInputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    pricingStatus: "verified",
    source: GEMINI_SRC,
    asOf: AS_OF,
  },
  "gemini-embedding-001": {
    provider: "google",
    modelId: "gemini-embedding-001",
    type: "embedding",
    inputUsdPer1M: 0.15,
    embeddingDimensions: 3072,
    pricingStatus: "verified",
    source: GEMINI_SRC,
    asOf: AS_OF,
  },
};

export const TOOL_PRICE_BOOK: Record<string, ToolPrice> = {
  "tavily.search.basic": {
    provider: "tavily",
    toolId: "tavily.search",
    operation: "basic",
    unit: "credit",
    unitsPerOperation: 1,
    usdPerUnit: TAVILY_PAYG_USD,
    pricingStatus: "verified",
    source: TAVILY_SRC,
    asOf: AS_OF,
  },
  "tavily.search.advanced": {
    provider: "tavily",
    toolId: "tavily.search",
    operation: "advanced",
    unit: "credit",
    unitsPerOperation: 2,
    usdPerUnit: TAVILY_PAYG_USD,
    pricingStatus: "verified",
    source: TAVILY_SRC,
    asOf: AS_OF,
  },
  "firecrawl.scrape.page": {
    provider: "firecrawl",
    toolId: "firecrawl.scrape",
    operation: "page",
    unit: "credit",
    unitsPerOperation: 1,
    usdPerUnit: FIRECRAWL_HOBBY_USD_PER_CREDIT,
    pricingStatus: "verified",
    source: FIRECRAWL_SRC,
    asOf: AS_OF,
  },
  "jina.reader.page": {
    provider: "jina",
    toolId: "jina.reader",
    operation: "page",
    unit: "request",
    unitsPerOperation: 1,
    usdPerUnit: 0,
    pricingStatus: "verified",
    source: JINA_SRC,
    asOf: AS_OF,
  },
};

export function getModelPrice(modelId: string): ModelPrice | null {
  return MODEL_PRICE_BOOK[modelId] ?? null;
}

export function getToolPrice(
  toolId: string,
  operation: string,
): ToolPrice | null {
  return TOOL_PRICE_BOOK[`${toolId}.${operation}`] ?? null;
}

function tavilyUsdPerCredit(): number {
  const raw = process.env.TAVILY_USD_PER_CREDIT?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return TAVILY_PAYG_USD;
}

function firecrawlUsdPerCredit(): number {
  const raw = process.env.FIRECRAWL_USD_PER_CREDIT?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return FIRECRAWL_HOBBY_USD_PER_CREDIT;
}

/** USD micros (1e-6 USD), or null when pricing is unverified. */
export function modelCostMicros(input: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  /** When true, apply `audioInputUsdPer1M` if the model defines one. */
  inputModality?: "text" | "audio";
}): { costMicros: number | null; pricingStatus: PricingStatus } {
  const entry = getModelPrice(input.modelId);
  if (!entry || entry.pricingStatus !== "verified") {
    return { costMicros: null, pricingStatus: "unknown" };
  }
  if (entry.type === "embedding") {
    if (entry.inputUsdPer1M == null) {
      return { costMicros: null, pricingStatus: "unknown" };
    }
    const usd =
      (Math.max(0, input.inputTokens) / 1_000_000) * entry.inputUsdPer1M;
    return {
      costMicros: Math.round(usd * 1_000_000),
      pricingStatus: "verified",
    };
  }
  const inputRate =
    input.inputModality === "audio" && entry.audioInputUsdPer1M != null
      ? entry.audioInputUsdPer1M
      : entry.inputUsdPer1M;
  if (inputRate == null || entry.outputUsdPer1M == null) {
    return { costMicros: null, pricingStatus: "unknown" };
  }
  const usd =
    (Math.max(0, input.inputTokens) / 1_000_000) * inputRate +
    (Math.max(0, input.outputTokens) / 1_000_000) * entry.outputUsdPer1M;
  return {
    costMicros: Math.round(usd * 1_000_000),
    pricingStatus: "verified",
  };
}

export function toolCostMicros(input: {
  toolId: string;
  operation: string;
  quantity?: number;
}): {
  quantity: number;
  unit: string;
  costMicros: number | null;
  pricingStatus: PricingStatus;
} {
  const entry = getToolPrice(input.toolId, input.operation);
  if (!entry) {
    return {
      quantity: input.quantity ?? 1,
      unit: "request",
      costMicros: null,
      pricingStatus: "unknown",
    };
  }
  const quantity = input.quantity ?? entry.unitsPerOperation;
  const usdPerUnit =
    entry.provider === "tavily"
      ? tavilyUsdPerCredit()
      : entry.provider === "firecrawl"
        ? firecrawlUsdPerCredit()
        : entry.usdPerUnit;
  if (
    entry.pricingStatus !== "verified" ||
    usdPerUnit == null ||
    !Number.isFinite(usdPerUnit)
  ) {
    return {
      quantity,
      unit: entry.unit,
      costMicros: null,
      pricingStatus: "unknown",
    };
  }
  return {
    quantity,
    unit: entry.unit,
    costMicros: Math.round(quantity * usdPerUnit * 1_000_000),
    pricingStatus: "verified",
  };
}
