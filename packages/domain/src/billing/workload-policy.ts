/**
 * Authoritative product policy for AI workloads, credits, and plan caps.
 * Admin Unit Economics, customer billing/usage, and runtime budgets all read here.
 *
 * Credits are abstract usage units — not USD and not provider tokens.
 * Shared wallet costs: Simple 1 · Standard 2 · Complex 8.
 * Provider COGS stays on usage_events for admin telemetry only.
 */

export const AI_CREDIT_CLASSES = ["simple", "standard", "complex"] as const;

export type AiCreditClass = (typeof AI_CREDIT_CLASSES)[number];

export type WorkloadPlanId = "free" | "starter" | "pro" | "business";

export type WorkloadComplexityTier = "low" | "medium" | "high";

/** Shared-wallet spend per workload (set after delivery, capped by effective route). */
export const AI_CREDIT_COSTS: Record<AiCreditClass, number> = {
  simple: 1,
  standard: 2,
  complex: 8,
};

export const MAX_CREDITS_PER_REQUEST = AI_CREDIT_COSTS.complex;

/** Included AI credits granted per billing period (shared wallet). */
export const AI_CREDITS_INCLUDED_BY_PLAN: Record<WorkloadPlanId, number> = {
  free: 500,
  starter: 2_000,
  pro: 5_000,
  business: 15_000,
};

/** Conservative planning average credits / request across the mix. */
export const AVG_CREDITS_PER_QUERY = 3;

/** Legacy planning mix retained for unit-economics projections. */
export const PLANNING_MIX: Record<AiCreditClass, number> = {
  simple: 0.6,
  standard: 0.3,
  complex: 0.1,
};

/** Hard per-period query limits used by the router. */
export const PLAN_CLASS_QUOTAS: Record<
  WorkloadPlanId,
  Record<AiCreditClass, number>
> = {
  free: { simple: 100, standard: 50, complex: 20 },
  starter: { simple: 400, standard: 200, complex: 70 },
  pro: { simple: 1_000, standard: 500, complex: 150 },
  business: { simple: 3_000, standard: 1_500, complex: 500 },
};

/** Conservative token assumptions used for capacity and COGS planning. */
export const TOKEN_PLANNING_ASSUMPTIONS = {
  systemPromptTokensApprox: 1_200,
  historyTurns: 10,
  historyTokensPerTurnApprox: 300,
  newQueryTokensApprox: 100,
} as const;

const BASE_INPUT_TOKENS_APPROX =
  TOKEN_PLANNING_ASSUMPTIONS.systemPromptTokensApprox +
  TOKEN_PLANNING_ASSUMPTIONS.historyTurns *
    TOKEN_PLANNING_ASSUMPTIONS.historyTokensPerTurnApprox +
  TOKEN_PLANNING_ASSUMPTIONS.newQueryTokensApprox;

export interface WorkloadBudget {
  id: AiCreditClass;
  name: string;
  credits: number;
  complexityTier: WorkloadComplexityTier;
  modelLabel: string;
  rounds: number;
  totalToolCalls: number;
  tools: string;
  ragChunks: number;
  ragChars: number;
  ragTokensApprox: number;
  modelCallsMax: number;
  inputTokensPerModelCallApprox: number;
  maxInputTokensPerRequestApprox: number;
  baseContextCogsUsdApprox: number;
  databaseRows: number;
  databaseTimeoutSeconds: number;
  allowQueryExpansion: boolean;
  fallback: string;
  estimatedCogsUsd: { min: number; max: number };
  chargeReferenceUsd: { min: number; max: number };
  latency: string;
}

export type WorkloadDowngradeReason =
  | "insufficient_credits"
  | "class_limit_fallback"
  | "on_demand_passthrough"
  | "none";

export type AffordableWorkloadDecision = {
  requestedClass: AiCreditClass;
  effectiveClass: AiCreditClass;
  downgradedFrom: AiCreditClass | null;
  reason: WorkloadDowngradeReason;
  billingMode: "included" | "on_demand";
  reservedCredits: number;
  availableCredits: number;
};

function tokenBudget(
  ragTokensApprox: number,
  toolRounds: number,
  modelInputUsdPer1M: number,
) {
  const modelCallsMax = toolRounds + 1;
  const inputTokensPerModelCallApprox =
    BASE_INPUT_TOKENS_APPROX + ragTokensApprox;
  return {
    modelCallsMax,
    inputTokensPerModelCallApprox,
    maxInputTokensPerRequestApprox:
      inputTokensPerModelCallApprox * modelCallsMax,
    baseContextCogsUsdApprox:
      (BASE_INPUT_TOKENS_APPROX * modelCallsMax * modelInputUsdPer1M) /
      1_000_000,
  };
}

export const WORKLOAD_BUDGETS: Record<AiCreditClass, WorkloadBudget> = {
  simple: {
    id: "simple",
    name: "Simple",
    credits: AI_CREDIT_COSTS.simple,
    complexityTier: "low",
    modelLabel: "Low · Flash-Lite",
    rounds: 1,
    totalToolCalls: 2,
    tools: "Knowledge search, read-only database",
    ragChunks: 4,
    ragChars: 4_800,
    ragTokensApprox: 1_200,
    ...tokenBudget(1_200, 1, 0.25),
    databaseRows: 30,
    databaseTimeoutSeconds: 15,
    allowQueryExpansion: false,
    fallback: "Answer from available evidence or application handoff",
    estimatedCogsUsd: { min: 0.0027, max: 0.0037 },
    chargeReferenceUsd: { min: 0.0054, max: 0.0074 },
    latency: "≈2–5s",
  },
  standard: {
    id: "standard",
    name: "Standard",
    credits: AI_CREDIT_COSTS.standard,
    complexityTier: "medium",
    modelLabel: "Medium · Flash-Lite",
    rounds: 2,
    totalToolCalls: 4,
    tools: "Knowledge search, read-only database, meeting link",
    ragChunks: 10,
    ragChars: 12_000,
    ragTokensApprox: 3_000,
    ...tokenBudget(3_000, 2, 0.3),
    databaseRows: 75,
    databaseTimeoutSeconds: 15,
    allowQueryExpansion: true,
    fallback: "Stop further tools and answer; hand off if incomplete",
    estimatedCogsUsd: { min: 0.0069, max: 0.0119 },
    chargeReferenceUsd: { min: 0.045, max: 0.06 },
    latency: "≈5–12s",
  },
  complex: {
    id: "complex",
    name: "Complex",
    credits: AI_CREDIT_COSTS.complex,
    complexityTier: "high",
    modelLabel: "High · Gemini Flash",
    rounds: 2,
    totalToolCalls: 6,
    tools: "All enabled AI tools; escalation excluded",
    ragChunks: 30,
    ragChars: 36_000,
    ragTokensApprox: 9_000,
    ...tokenBudget(9_000, 2, 1.5),
    databaseRows: 200,
    databaseTimeoutSeconds: 15,
    allowQueryExpansion: true,
    fallback: "Application-level human handoff when the budget is exhausted",
    estimatedCogsUsd: { min: 0.0694, max: 0.1394 },
    chargeReferenceUsd: { min: 0.18, max: 0.28 },
    latency: "≈12–35s",
  },
};

export const WORKLOAD_BUDGET_LIST: WorkloadBudget[] = AI_CREDIT_CLASSES.map(
  (id) => WORKLOAD_BUDGETS[id],
);

/** Global ceilings (the largest class budget). Prefer per-class values at runtime. */
export const MAX_AGENT_TOOL_ROUNDS = WORKLOAD_BUDGETS.complex.rounds;
export const MAX_TOOL_CALLS_PER_TURN = WORKLOAD_BUDGETS.complex.totalToolCalls;
export const MAX_SEMANTIC_SEARCHES_PER_TURN = 2;
export const MAX_RAG_CHUNKS_RETURNED = WORKLOAD_BUDGETS.complex.ragChunks;
export const MAX_RAG_CHARS_TO_MODEL = WORKLOAD_BUDGETS.complex.ragChars;
export const DATABASE_STATEMENT_TIMEOUT_SECONDS =
  WORKLOAD_BUDGETS.simple.databaseTimeoutSeconds;

export const AI_CREDIT_CLASS_LABELS: Record<AiCreditClass, string> = {
  simple: "Simple",
  standard: "Standard",
  complex: "Complex",
};

export const AI_CREDIT_CLASS_EXPLANATIONS: Record<AiCreditClass, string> = {
  simple:
    "Meaningful short company-related answers within a tiny tool budget. Pure social turns are free.",
  standard:
    "Typical product or support answers with a modest knowledge or database lookup.",
  complex:
    "Multi-step or high-context work. Charged from observed tool/round usage after delivery.",
};

export const CREDIT_ESTIMATOR_VERSION = "v5-class-query-limits";

/** Descending cost order for affordability downgrades. */
export const WORKLOAD_DOWNGRADE_LADDER: AiCreditClass[] = [
  "complex",
  "standard",
  "simple",
];

export function isAiCreditClass(value: unknown): value is AiCreditClass {
  return (
    value === "simple" || value === "standard" || value === "complex"
  );
}

export function workloadClassOrDefault(
  value: unknown,
  fallback: AiCreditClass = "standard",
): AiCreditClass {
  return isAiCreditClass(value) ? value : fallback;
}

export function creditsForClass(klass: AiCreditClass): number {
  return AI_CREDIT_COSTS[klass];
}

export function getWorkloadBudget(klass: AiCreditClass): WorkloadBudget {
  return WORKLOAD_BUDGETS[klass];
}

export function complexityTierForClass(
  klass: AiCreditClass,
): WorkloadComplexityTier {
  return WORKLOAD_BUDGETS[klass].complexityTier;
}

export function classForComplexityTier(
  tier: WorkloadComplexityTier,
): AiCreditClass {
  if (tier === "low") return "simple";
  if (tier === "high") return "complex";
  return "standard";
}

export function classQuotasForPlan(
  plan: WorkloadPlanId,
): Record<AiCreditClass, number> {
  return PLAN_CLASS_QUOTAS[plan];
}

/** Every workload class has a plan-specific hard per-period query limit. */
export function isHardCappedWorkloadClass(_klass: AiCreditClass): boolean {
  return true;
}

export function classRank(klass: AiCreditClass): number {
  if (klass === "complex") return 2;
  if (klass === "standard") return 1;
  return 0;
}

export function minWorkloadClass(
  a: AiCreditClass,
  b: AiCreditClass,
): AiCreditClass {
  return classRank(a) <= classRank(b) ? a : b;
}

export function maxWorkloadClass(
  a: AiCreditClass,
  b: AiCreditClass,
): AiCreditClass {
  return classRank(a) >= classRank(b) ? a : b;
}

/**
 * Cap a post-delivery observed class so it cannot exceed the effective
 * runtime route (prevents downgraded Simple/Standard turns billing as Complex).
 */
export function capBillableClass(
  observed: AiCreditClass,
  effectiveRoute: AiCreditClass | null | undefined,
): AiCreditClass {
  if (!effectiveRoute) return observed;
  return minWorkloadClass(observed, effectiveRoute);
}

/**
 * Choose the highest affordable class on the downgrade ladder.
 * Paid overage: when available credits cannot fund even Simple, keep the
 * requested class and mark billing as on_demand.
 */
export function resolveAffordableWorkload(input: {
  requestedClass: AiCreditClass;
  availableCredits: number;
  onDemandEnabled: boolean;
  billable?: boolean;
}): AffordableWorkloadDecision {
  const requestedClass = input.requestedClass;
  const available = Math.max(0, Math.floor(input.availableCredits));

  if (input.billable === false) {
    return {
      requestedClass,
      effectiveClass: requestedClass,
      downgradedFrom: null,
      reason: "none",
      billingMode: "included",
      reservedCredits: 0,
      availableCredits: available,
    };
  }

  const ladder = WORKLOAD_DOWNGRADE_LADDER.filter(
    (klass) => classRank(klass) <= classRank(requestedClass),
  );

  for (const klass of ladder) {
    const cost = creditsForClass(klass);
    if (available >= cost) {
      return {
        requestedClass,
        effectiveClass: klass,
        downgradedFrom: klass === requestedClass ? null : requestedClass,
        reason: klass === requestedClass ? "none" : "insufficient_credits",
        billingMode: "included",
        reservedCredits: cost,
        availableCredits: available,
      };
    }
  }

  if (input.onDemandEnabled) {
    return {
      requestedClass,
      effectiveClass: requestedClass,
      downgradedFrom: null,
      reason: "on_demand_passthrough",
      billingMode: "on_demand",
      reservedCredits: 0,
      availableCredits: available,
    };
  }

  return {
    requestedClass,
    effectiveClass: "simple",
    downgradedFrom: requestedClass === "simple" ? null : requestedClass,
    reason: "insufficient_credits",
    billingMode: "included",
    reservedCredits: 0,
    availableCredits: available,
  };
}

/**
 * Apply hard query limits before runtime routing.
 *
 * Borrowing is one-way and does not consume the lending class counter:
 * Simple may borrow remaining Standard/Complex capacity; Standard may borrow
 * remaining Complex capacity; Complex never borrows downward. When no allowed
 * capacity remains, the request runs with the cheapest Simple budget.
 */
export function resolveClassLimitedWorkload(input: {
  requestedClass: AiCreditClass;
  used: Record<AiCreditClass, number>;
  limits: Record<AiCreditClass, number>;
  availableCredits: number;
  onDemandEnabled: boolean;
  billable?: boolean;
}): AffordableWorkloadDecision {
  const available = Math.max(0, Math.floor(input.availableCredits));
  if (input.billable === false) {
    return {
      requestedClass: input.requestedClass,
      effectiveClass: input.requestedClass,
      downgradedFrom: null,
      reason: "none",
      billingMode: "included",
      reservedCredits: 0,
      availableCredits: available,
    };
  }

  const hasCapacity = (klass: AiCreditClass) =>
    Math.max(0, input.used[klass]) < Math.max(0, input.limits[klass]);
  const requestedCost = creditsForClass(input.requestedClass);
  const ownCapacity = hasCapacity(input.requestedClass);
  const mayBorrow =
    input.requestedClass === "simple"
      ? hasCapacity("standard") || hasCapacity("complex")
      : input.requestedClass === "standard"
        ? hasCapacity("complex")
        : false;

  if (
    (ownCapacity || mayBorrow) &&
    (available >= requestedCost ||
      (ownCapacity && available === 0 && input.onDemandEnabled))
  ) {
    const onDemand = available < requestedCost;
    return {
      requestedClass: input.requestedClass,
      effectiveClass: input.requestedClass,
      downgradedFrom: null,
      reason: onDemand ? "on_demand_passthrough" : "none",
      billingMode: onDemand ? "on_demand" : "included",
      reservedCredits: onDemand ? 0 : requestedCost,
      availableCredits: available,
    };
  }

  const simpleCost = creditsForClass("simple");
  const simpleOnDemand = available < simpleCost && input.onDemandEnabled;
  return {
    requestedClass: input.requestedClass,
    effectiveClass: "simple",
    downgradedFrom:
      input.requestedClass === "simple" ? null : input.requestedClass,
    reason: "class_limit_fallback",
    billingMode: simpleOnDemand ? "on_demand" : "included",
    reservedCredits:
      available >= simpleCost ? simpleCost : 0,
    availableCredits: available,
  };
}

export function quotaCreditBurn(plan: WorkloadPlanId): number {
  const quotas = PLAN_CLASS_QUOTAS[plan];
  return (
    quotas.simple * AI_CREDIT_COSTS.simple +
    quotas.standard * AI_CREDIT_COSTS.standard +
    quotas.complex * AI_CREDIT_COSTS.complex
  );
}

export function quotaInputTokensApprox(plan: WorkloadPlanId): number {
  const quotas = PLAN_CLASS_QUOTAS[plan];
  return AI_CREDIT_CLASSES.reduce(
    (total, klass) =>
      total +
      quotas[klass] * WORKLOAD_BUDGETS[klass].maxInputTokensPerRequestApprox,
    0,
  );
}

export function quotaRagInputTokensApprox(plan: WorkloadPlanId): number {
  const quotas = PLAN_CLASS_QUOTAS[plan];
  return AI_CREDIT_CLASSES.reduce(
    (total, klass) =>
      total +
      quotas[klass] *
        WORKLOAD_BUDGETS[klass].ragTokensApprox *
        WORKLOAD_BUDGETS[klass].modelCallsMax,
    0,
  );
}

export function expectedCogsAtQuotaMixUsd(plan: WorkloadPlanId): number {
  const quotas = PLAN_CLASS_QUOTAS[plan];
  return AI_CREDIT_CLASSES.reduce((total, klass) => {
    const range = WORKLOAD_BUDGETS[klass].estimatedCogsUsd;
    return total + quotas[klass] * ((range.min + range.max) / 2);
  }, 0);
}

export function maxCogsAtQuotaMixUsd(plan: WorkloadPlanId): number {
  const quotas = PLAN_CLASS_QUOTAS[plan];
  return AI_CREDIT_CLASSES.reduce(
    (total, klass) =>
      total + quotas[klass] * WORKLOAD_BUDGETS[klass].estimatedCogsUsd.max,
    0,
  );
}

export function formatUsdRange(min: number, max: number, digits = 4): string {
  const fmt = (n: number) => {
    if (n >= 0.01) return `$${n.toFixed(Math.min(digits, 2))}`;
    return `$${n.toFixed(digits)}`.replace(/0+$/, "").replace(/\.$/, "");
  };
  return `${fmt(min)}–${fmt(max)}`;
}

export function formatClassQuotas(
  quotas: Record<AiCreditClass, number>,
): string {
  return `${quotas.simple.toLocaleString()} Simple · ${quotas.standard.toLocaleString()} Standard · ${quotas.complex.toLocaleString()} Complex max queries`;
}

export function periodKeyFromDate(date: Date | string | null | undefined): string {
  const d = date instanceof Date ? date : date ? new Date(date) : new Date();
  if (!Number.isFinite(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/** Rubric injected into the light classifier prompt (runtime budgets only). */
export function workloadClassifierRubric(): string {
  const rows = WORKLOAD_BUDGET_LIST.map((row) => {
    return `- ${row.name} (runtime budget · ${row.credits} credit${row.credits === 1 ? "" : "s"}): ${row.modelLabel}. ${row.rounds} round${row.rounds === 1 ? "" : "s"} · ${row.totalToolCalls} total tool calls. Tools: ${row.tools}. RAG: ${row.ragChunks} chunks · ${row.ragChars.toLocaleString()} chars · ≈${row.ragTokensApprox.toLocaleString()} tokens. Database: ${row.databaseRows} result rows · ${row.databaseTimeoutSeconds}s timeout. Latency ${row.latency}.`;
  }).join("\n");
  return `Classify the visitor query into exactly one runtime workload budget. Guess from the question and available tools — do not execute tools. Billing credits are decided after delivery from observed usage, capped by the effective runtime class after plan query-limit routing (Simple ${AI_CREDIT_COSTS.simple} · Standard ${AI_CREDIT_COSTS.standard} · Complex ${AI_CREDIT_COSTS.complex}).

Workload budgets:
${rows}

Rules:
- First decide billability: only a turn that solves or advances a user-company problem consumes credits later.
- Pure social chatter and acknowledgements (hi, hello, thanks, okay, goodbye, how are you) are not billable.
- Simple: meaningful yes/no, tiny company-related factual replies, or a single cheap lookup.
- Standard: typical product/support answers that may need knowledge search, a meeting link, or a modest database read.
- Complex: multi-step, large-context, aggregations across many rows, or several tools.
- Prefer the cheaper class when unsure.
- Simple must not assume query-expansion or an LLM reranker.
- Escalation is an application handoff, never a model tool.`;
}
