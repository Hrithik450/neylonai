import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getProviderModel } from "../providers";
import {
  AI_CREDIT_COSTS,
  CREDIT_ESTIMATOR_VERSION,
  classForComplexityTier,
  complexityTierForClass,
  creditsForClass,
  getWorkloadBudget,
  isAiCreditClass,
  type AiCreditClass,
  type ConversationWorkloadSnapshot,
  type OrgWorkloadSummary,
  type ToolCostHint,
  type TurnCreditEstimate,
  formatWorkloadBytes,
  toSafeOrgWorkloadSummary,
} from "@neylonai/domain/billing";
import { meterModelResponse } from "../infrastructure/metering";
import { prompts } from "../lib/prompts";
import {
  getAgentModelHigh,
  getAgentModelLow,
  getAgentModelMedium,
  getClassifierModel,
} from "../lib/models";

export type ComplexityTier = "low" | "medium" | "high";
export type TokenBand = "xs" | "s" | "m" | "l" | "xl";

const TOKEN_BANDS = new Set<TokenBand>(["xs", "s", "m", "l", "xl"]);

export interface ModelRoute {
  complexity: ComplexityTier;
  workloadClass: AiCreditClass;
  /** Whether this turn solves a user-company problem and consumes credits. */
  billable: boolean;
  model: string;
  /** How the route was chosen. */
  source: "heuristic" | "classifier" | "fallback";
  estimatedCredits: number;
  estimatedClass: AiCreditClass;
  /** Classifier / heuristic request before query-limit routing. */
  requestedClass?: AiCreditClass;
  downgradedFrom?: AiCreditClass | null;
  billingMode?: "included" | "on_demand";
  likelyTools: string[];
  expectedSearchRounds: number;
  expectedToolRounds: number;
  expectedInputTokensBand: TokenBand;
  expectedOutputTokensBand: TokenBand;
  confidence: number;
  reason: string;
}

export type CreditEstimatorInput = {
  question: string;
  availableTools: ToolCostHint[];
  workload: OrgWorkloadSummary;
  conversation: ConversationWorkloadSnapshot;
};

/** Fastest model for routing classification (latency-first). */
export function getClassifierModelId(): string {
  return getClassifierModel();
}

export function getModelForComplexity(complexity: ComplexityTier): string {
  switch (complexity) {
    case "low":
      return getAgentModelLow();
    case "medium":
      return getAgentModelMedium();
    case "high":
      return getAgentModelHigh();
  }
}

export function toTurnCreditEstimate(route: ModelRoute): TurnCreditEstimate {
  return {
    billable: route.billable,
    estimatedCredits: route.estimatedCredits,
    estimatedClass: route.estimatedClass,
    requestedClass: route.requestedClass ?? route.workloadClass,
    effectiveClass: route.workloadClass,
    downgradedFrom: route.downgradedFrom ?? null,
    billingMode: route.billingMode ?? "included",
    confidence: route.confidence,
    likelyTools: route.likelyTools,
    expectedSearchRounds: route.expectedSearchRounds,
    expectedToolRounds: route.expectedToolRounds,
    expectedInputTokensBand: route.expectedInputTokensBand,
    expectedOutputTokensBand: route.expectedOutputTokensBand,
    reason: route.reason,
    source: route.source,
    estimatorVersion: CREDIT_ESTIMATOR_VERSION,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function asTokenBand(value: unknown, fallback: TokenBand): TokenBand {
  return typeof value === "string" && TOKEN_BANDS.has(value as TokenBand)
    ? (value as TokenBand)
    : fallback;
}

function asComplexity(value: unknown): ComplexityTier | null {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : null;
}

function asWorkloadClass(value: unknown): AiCreditClass | null {
  if (isAiCreditClass(value)) return value;
  return null;
}

export function routeFromClass(
  klass: AiCreditClass,
  extra: Omit<
    ModelRoute,
    | "complexity"
    | "workloadClass"
    | "model"
    | "estimatedCredits"
    | "estimatedClass"
  >,
): ModelRoute {
  const budget = getWorkloadBudget(klass);
  const complexity = complexityTierForClass(klass);
  return {
    ...extra,
    complexity,
    workloadClass: klass,
    model: getModelForComplexity(complexity),
    estimatedCredits: extra.billable ? creditsForClass(klass) : 0,
    estimatedClass: klass,
    requestedClass: extra.requestedClass ?? klass,
    downgradedFrom: extra.downgradedFrom ?? null,
    billingMode: extra.billingMode ?? "included",
    expectedSearchRounds: clamp(
      extra.expectedSearchRounds,
      0,
      klass === "simple" ? 1 : 2,
    ),
    expectedToolRounds: clamp(extra.expectedToolRounds, 0, budget.rounds),
  };
}

/**
 * Remap a classified route onto the affordable effective class so model,
 * credit estimate, and runtime budgets all flip together.
 */
export function applyAffordabilityToRoute(
  route: ModelRoute,
  decision: {
    requestedClass: AiCreditClass;
    effectiveClass: AiCreditClass;
    downgradedFrom: AiCreditClass | null;
    billingMode: "included" | "on_demand";
    reason: string;
  },
): ModelRoute {
  const remapped = routeFromClass(decision.effectiveClass, {
    billable: route.billable,
    source: route.source,
    likelyTools: route.likelyTools,
    expectedSearchRounds: route.expectedSearchRounds,
    expectedToolRounds: route.expectedToolRounds,
    expectedInputTokensBand: route.expectedInputTokensBand,
    expectedOutputTokensBand: route.expectedOutputTokensBand,
    confidence: route.confidence,
    reason:
      decision.downgradedFrom != null
        ? `${route.reason}; remapped ${decision.requestedClass}→${decision.effectiveClass} (${decision.reason})`
        : route.reason,
    requestedClass: decision.requestedClass,
    downgradedFrom: decision.downgradedFrom,
    billingMode: decision.billingMode,
  });
  if (decision.billingMode === "on_demand" && route.billable) {
    remapped.estimatedCredits = creditsForClass(decision.effectiveClass);
  }
  return remapped;
}

/**
 * Instant heuristics — skip the classifier LLM when the signal is obvious.
 * Returns null when an LLM classification is still needed.
 */
export function classifyComplexityHeuristic(
  question: string,
): ComplexityTier | null {
  const q = question.trim();
  if (!q) return "low";

  const lower = q.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean).length;

  if (
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|bye|goodbye|good morning|good afternoon|good evening|how are you|how are you doing|what'?s up)\b/i.test(
      lower,
    ) &&
    words <= 8
  ) {
    return "low";
  }

  return null;
}

/** Social acknowledgements are answered normally but never consume credits. */
export function isNonBillableSocialQuery(question: string): boolean {
  const normalized = question
    .trim()
    .toLowerCase()
    .replace(/[!?.,'"]/g, "")
    .replace(/\s+/g, " ");
  return /^((hi|hello|hey|hiya)( there| everyone| team)?|thanks|thank you|ok|okay|bye|goodbye|good morning|good afternoon|good evening|how are you|how are you doing|whats up|what is up)$/.test(
    normalized,
  );
}

export function buildFallbackRoute(
  availableToolNames: string[] = [],
): ModelRoute {
  return routeFromClass("standard", {
    billable: true,
    source: "fallback",
    likelyTools: availableToolNames.includes("semantic_search")
      ? ["semantic_search"]
      : [],
    expectedSearchRounds: availableToolNames.includes("semantic_search") ? 1 : 0,
    expectedToolRounds: 1,
    expectedInputTokensBand: "m",
    expectedOutputTokensBand: "s",
    confidence: 0.3,
    reason: "Classifier unavailable; conservative Standard estimate",
  });
}

export type HeuristicRouteOptions = {
  availableToolNames?: string[];
  chunkCount?: number;
};

function isLikelySimpleKnowledgeQuestion(question: string): boolean {
  const q = question.trim();
  const words = q.split(/\s+/).filter(Boolean).length;
  if (words === 0 || words > 18) return false;
  if (
    /\b(analy[sz]e|compare|versus|vs\.|sql|schema|database|debug|implement|write code|step by step)\b/i.test(
      q,
    )
  ) {
    return false;
  }
  if (
    /\?/.test(q) ||
    /^(what|how|who|when|where|why|is|are|can|does|do|will|should|tell me|explain)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  return words <= 10;
}

export function buildHeuristicRoute(
  question: string,
  options: HeuristicRouteOptions = {},
): ModelRoute | null {
  const heuristic = classifyComplexityHeuristic(question);
  if (heuristic) {
    const klass = classForComplexityTier(heuristic);
    return routeFromClass(klass, {
      billable: !isNonBillableSocialQuery(question),
      source: "heuristic",
      likelyTools: [],
      expectedSearchRounds: 0,
      expectedToolRounds: 0,
      expectedInputTokensBand: "xs",
      expectedOutputTokensBand: "xs",
      confidence: 0.92,
      reason: "Greeting or lightweight conversational turn",
    });
  }

  const { availableToolNames = [], chunkCount } = options;
  if (
    chunkCount != null &&
    chunkCount <= 30 &&
    availableToolNames.includes("semantic_search") &&
    isLikelySimpleKnowledgeQuestion(question) &&
    !isNonBillableSocialQuery(question)
  ) {
    return routeFromClass("simple", {
      billable: true,
      source: "heuristic",
      likelyTools: ["semantic_search"],
      expectedSearchRounds: 1,
      expectedToolRounds: 1,
      expectedInputTokensBand: "s",
      expectedOutputTokensBand: "s",
      confidence: 0.88,
      reason: "Short knowledge question on a small corpus",
    });
  }

  return null;
}

export function parseCreditClassifierDecision(
  raw: string,
  availableToolNames: string[],
): ModelRoute | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const workloadClass =
      asWorkloadClass(parsed.workload) ??
      asWorkloadClass(parsed.complexityClass) ??
      (asComplexity(parsed.complexity)
        ? classForComplexityTier(asComplexity(parsed.complexity)!)
        : null);
    if (!workloadClass) return null;
    if (typeof parsed.billable !== "boolean") return null;

    const allowed = new Set(availableToolNames);
    const likelyTools = Array.isArray(parsed.likelyTools)
      ? parsed.likelyTools.filter(
          (name): name is string =>
            typeof name === "string" && allowed.has(name),
        )
      : [];

    const confidenceRaw = Number(parsed.confidence);
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 180)
        : "Classifier workload estimate";

    const budget = getWorkloadBudget(workloadClass);
    return routeFromClass(workloadClass, {
      billable: parsed.billable,
      source: "classifier",
      likelyTools: [...new Set(likelyTools)].slice(0, 8),
      expectedSearchRounds: clamp(
        Number(parsed.expectedSearchRounds),
        0,
        workloadClass === "simple" ? 1 : 2,
      ),
      expectedToolRounds: clamp(
        Number(parsed.expectedToolRounds),
        0,
        budget.rounds,
      ),
      expectedInputTokensBand: asTokenBand(parsed.expectedInputTokensBand, "m"),
      expectedOutputTokensBand: asTokenBand(
        parsed.expectedOutputTokensBand,
        "s",
      ),
      confidence: Number.isFinite(confidenceRaw)
        ? Math.min(1, Math.max(0, confidenceRaw))
        : 0.5,
      reason,
    });
  } catch {
    return null;
  }
}

export function buildEstimatorUserMessage(input: CreditEstimatorInput): string {
  const workload = toSafeOrgWorkloadSummary(input.workload);
  const tools = (input.availableTools ?? []).map((tool) => ({
    name: tool.name,
    estimatedUsdPerCall: tool.estimatedUsdPerCall,
    pricingStatus: tool.pricingStatus,
  }));
  const payload = {
    question: input.question.slice(0, 500),
    conversation: {
      messageCount: input.conversation.messageCount,
      characterCount: input.conversation.characterCount,
      queryCharacterCount: input.conversation.queryCharacterCount,
    },
    knowledge: {
      sourceCount: workload.sourceCount,
      documentCount: workload.documentCount,
      chunkCount: workload.chunkCount,
      rawContentSize: formatWorkloadBytes(workload.rawContentBytes),
      rawContentBytes: workload.rawContentBytes,
    },
    enabledCapabilityIds: workload.enabledCapabilityIds,
    availableTools: tools,
    creditCosts: AI_CREDIT_COSTS,
  };
  return JSON.stringify(payload);
}

/**
 * Route a user question into Simple / Standard / Complex with a light LLM.
 * Heuristics first for greetings; otherwise Flash-Lite JSON classify.
 * Tools are named only — never executed.
 */
export async function routeModel(
  input: CreditEstimatorInput,
): Promise<ModelRoute> {
  const availableToolNames = input.availableTools.map((tool) => tool.name);
  const heuristic = buildHeuristicRoute(input.question, {
    availableToolNames,
    chunkCount: input.workload.chunkCount,
  });
  if (heuristic) return heuristic;

  try {
    const classifierModel = getClassifierModelId();
    const llm = getProviderModel("simple", {
      temperature: 0,
      jsonMode: true,
    });
    
    const response = await llm.invoke([
      new SystemMessage(prompts.complexityClassifier),
      new HumanMessage(buildEstimatorUserMessage(input)),
    ]);
    meterModelResponse(classifierModel, response);
    const raw =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    return (
      parseCreditClassifierDecision(raw, availableToolNames) ??
      buildFallbackRoute(availableToolNames)
    );
  } catch (error) {
    console.warn(
      "[model-router] classifier failed, falling back to standard:",
      error instanceof Error ? error.message : error,
    );
    return buildFallbackRoute(availableToolNames);
  }
}
