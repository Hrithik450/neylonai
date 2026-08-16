/**
 * AI credit classification + ledger + reservations.
 *
 * Customer entitlement = shared credit pool (Simple 1 · Standard 2 · Complex 8).
 * Preflight: apply hard class limits and one-way borrowing, then reserve the
 * effective class cost. Exhausted routes use the Simple runtime budget.
 * Post-delivery: observe usage, cap billed class at the
 * effective route, settle the reservation, and debit (with paid on-demand
 * overage when included credits are gone).
 * Provider COGS stays on usage_events for admin telemetry only.
 */

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  creditLedger,
  subscriptions,
  usageClassPeriodCounters,
  usageEvents,
  usageRequestReservations,
  usageRequestRollups,
} from "@neylonai/database";
import { ApiAuthError } from "./keys";
import {
  getPlanEntitlements,
  normalizePlanId,
  type PlanId,
} from "./plans";
import {
  AI_CREDIT_CLASSES,
  AI_CREDIT_CLASS_EXPLANATIONS,
  AI_CREDIT_CLASS_LABELS,
  AI_CREDIT_COSTS,
  CREDIT_ESTIMATOR_VERSION,
  MAX_AGENT_TOOL_ROUNDS,
  MAX_CREDITS_PER_REQUEST,
  MAX_RAG_CHARS_TO_MODEL,
  MAX_RAG_CHUNKS_RETURNED,
  MAX_SEMANTIC_SEARCHES_PER_TURN,
  WORKLOAD_BUDGETS,
  capBillableClass,
  classQuotasForPlan,
  creditsForClass,
  periodKeyFromDate,
  resolveClassLimitedWorkload,
  workloadClassOrDefault,
  type AffordableWorkloadDecision,
  type AiCreditClass,
} from "./workload-policy";

export {
  AI_CREDIT_CLASSES,
  AI_CREDIT_CLASS_EXPLANATIONS,
  AI_CREDIT_CLASS_LABELS,
  AI_CREDIT_COSTS,
  CREDIT_ESTIMATOR_VERSION,
  MAX_AGENT_TOOL_ROUNDS,
  MAX_CREDITS_PER_REQUEST,
  MAX_RAG_CHARS_TO_MODEL,
  MAX_RAG_CHUNKS_RETURNED,
  MAX_SEMANTIC_SEARCHES_PER_TURN,
  type AiCreditClass,
};

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i++) {
    const rec = current as { code?: unknown; cause?: unknown };
    if (rec.code === "23505") return true;
    current = rec.cause;
  }
  return false;
}

export type CreditLedgerEntryType =
  | "plan_grant"
  | "ai_consumption"
  | "ai_on_demand"
  | "refund"
  | "adjustment"
  | "expiration";

export type TurnCreditEstimate = {
  /** False for social/non-problem-solving turns, which are always free. */
  billable: boolean;
  estimatedCredits: number;
  estimatedClass: AiCreditClass;
  requestedClass?: AiCreditClass;
  effectiveClass?: AiCreditClass;
  downgradedFrom?: AiCreditClass | null;
  billingMode?: "included" | "on_demand";
  confidence: number;
  likelyTools: string[];
  expectedSearchRounds: number;
  expectedToolRounds: number;
  expectedInputTokensBand: string;
  expectedOutputTokensBand: string;
  reason: string;
  source: "heuristic" | "classifier" | "fallback";
  estimatorVersion: string;
};

export type TurnCreditSignals = {
  complexityTier?: "low" | "medium" | "high" | null;
  routeSource?: "heuristic" | "classifier" | "fallback" | null;
  routedModel?: string | null;
  agentRounds: number;
  toolsUsed: string[];
  semanticSearchCount: number;
  ragTokens?: number;
  databaseRows?: number;
  capped?: boolean;
  capReason?: string | null;
  estimate?: TurnCreditEstimate | null;
  /** Effective runtime class after query-limit routing. */
  workloadClass?: AiCreditClass | null;
  requestedClass?: AiCreditClass | null;
  downgradedFrom?: AiCreditClass | null;
  billingMode?: "included" | "on_demand" | null;
};

export type WorkloadMeter = {
  ok: boolean;
  hardCap: boolean;
  thresholdExceeded: boolean;
  used: number;
  reserved: number;
  limit: number;
  remaining: number;
  percent: number;
};

export type CreditBlockReason = "credits";

/**
 * Map observed post-delivery usage onto a workload class and credit charge.
 * Cap at the effective runtime route so affordability downgrades stick.
 */
export function classifyAiCreditClass(signals: TurnCreditSignals): {
  complexityClass: AiCreditClass;
  credits: number;
  reason: string;
} {
  if (signals.estimate?.billable === false) {
    return {
      complexityClass: "simple",
      credits: 0,
      reason: signals.estimate.reason || "Non-billable social turn",
    };
  }

  const toolCalls = signals.toolsUsed.length;
  const rounds = Math.max(0, signals.agentRounds);
  const searches = Math.max(0, signals.semanticSearchCount);
  const simple = WORKLOAD_BUDGETS.simple;
  const standard = WORKLOAD_BUDGETS.standard;
  const effectiveCap =
    signals.workloadClass ??
    signals.estimate?.effectiveClass ??
    signals.requestedClass ??
    null;

  let observed: AiCreditClass;
  let reason: string;

  if (
    signals.capped ||
    toolCalls > standard.totalToolCalls ||
    rounds > standard.rounds ||
    (searches >= 2 && toolCalls >= 3)
  ) {
    observed = "complex";
    reason = "Observed multi-step / high-budget turn";
  } else if (toolCalls === 0 && rounds <= 1 && searches === 0) {
    observed = "simple";
    reason = "Observed lightweight turn";
  } else if (
    toolCalls <= simple.totalToolCalls &&
    rounds <= simple.rounds &&
    searches <= 1
  ) {
    observed = "simple";
    reason = "Observed within Simple runtime budget";
  } else {
    observed = "standard";
    reason = "Observed Standard-budget turn";
  }

  const complexityClass = capBillableClass(observed, effectiveCap);
  if (complexityClass !== observed && effectiveCap) {
    reason = `${reason}; capped at effective ${effectiveCap} route`;
  }

  return {
    complexityClass,
    credits: AI_CREDIT_COSTS[complexityClass],
    reason,
  };
}

function tallyRequestCreditCharges(
  rows: Array<{
    entry_type: string;
    amount: number | string;
    balance_after: number | string;
  }>,
): {
  includedCharged: number;
  onDemandCharged: number;
  charged: number;
  balanceAfter: number;
} | null {
  if (rows.length === 0) return null;
  let includedCharged = 0;
  let onDemandCharged = 0;
  let balanceAfter = 0;
  for (const row of rows) {
    const amt = Math.abs(Number(row.amount));
    if (row.entry_type === "ai_on_demand") onDemandCharged += amt;
    else if (row.entry_type === "ai_consumption") includedCharged += amt;
    balanceAfter = Number(row.balance_after);
  }
  return {
    includedCharged,
    onDemandCharged,
    charged: includedCharged + onDemandCharged,
    balanceAfter,
  };
}

async function getCreditBalance(
  organizationId: string,
): Promise<{ balance: number; reserved: number; available: number }> {
  const [[sub], [reservation]] = await Promise.all([
    db
      .select({ balance: subscriptions.ai_credits_balance })
      .from(subscriptions)
      .where(eq(subscriptions.organization_id, organizationId))
      .limit(1),
    db
      .select({
        reserved: sql<number>`coalesce(sum(${usageRequestReservations.credits}), 0)::int`,
      })
      .from(usageRequestReservations)
      .innerJoin(
        subscriptions,
        and(
          eq(
            subscriptions.organization_id,
            usageRequestReservations.organization_id,
          ),
          eq(
            subscriptions.current_period_start,
            usageRequestReservations.period_start,
          ),
        ),
      )
      .where(
        and(
          eq(usageRequestReservations.organization_id, organizationId),
          eq(usageRequestReservations.status, "reserved"),
        ),
      ),
  ]);
  const balance = Number(sub?.balance ?? 0);
  const reserved = Math.max(0, Number(reservation?.reserved ?? 0));
  return {
    balance,
    reserved,
    available: Math.max(0, balance - reserved),
  };
}

function meterFrom(
  used: number,
  limit: number,
  reserved = 0,
  hardCap = false,
): WorkloadMeter {
  const occupied = used + reserved;
  const remaining = Math.max(0, limit - used - reserved);
  const percent =
    limit > 0 ? Math.round((occupied / limit) * 100) : 0;
  return {
    ok: true,
    hardCap,
    thresholdExceeded: occupied >= limit,
    used,
    reserved,
    limit,
    remaining,
    percent,
  };
}

async function resetClassCountersTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  periodStart: Date,
): Promise<void> {
  await tx
    .delete(usageClassPeriodCounters)
    .where(eq(usageClassPeriodCounters.organization_id, organizationId));

  await tx.insert(usageClassPeriodCounters).values(
    AI_CREDIT_CLASSES.map((klass) => ({
      organization_id: organizationId,
      period_start: periodStart,
      workload_class: klass,
      used: 0,
      reserved: 0,
      updated_at: new Date(),
    })),
  );
}

/**
 * Grant period credits (idempotent per org+period via period_key).
 * Resets class counters. Call on workspace create, plan change, and renewals.
 */
export async function grantPlanCredits(input: {
  organizationId: string;
  plan: string;
  reason?: string;
  force?: boolean;
  periodStart?: Date | null;
}): Promise<{ granted: number; balance: number }> {
  const planId = normalizePlanId(input.plan);
  const entitlement = getPlanEntitlements(planId);
  const amount = entitlement.aiCreditsPerMonth;

  return db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organization_id, input.organizationId))
      .limit(1)
      .for("update");

    if (!sub) throw new Error("Subscription missing for credit grant");

    const periodStart =
      input.periodStart ??
      sub.current_period_start ??
      new Date();
    const key = `${periodKeyFromDate(periodStart)}:${planId}`;

    const [existing] = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.organization_id, input.organizationId),
          eq(creditLedger.entry_type, "plan_grant"),
          eq(creditLedger.period_key, key),
        ),
      )
      .limit(1);
    if (existing && !input.force) {
      return {
        granted: 0,
        balance: Number(sub.ai_credits_balance),
      };
    }

    const periodKey =
      existing && input.force ? `${key}:adj:${Date.now()}` : key;

    await tx
      .update(subscriptions)
      .set({
        ai_credits_balance: amount,
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));

    await resetClassCountersTx(tx, input.organizationId, periodStart);

    await tx.insert(creditLedger).values({
      organization_id: input.organizationId,
      entry_type: "plan_grant",
      amount,
      balance_after: amount,
      reason: input.reason ?? `Plan grant (${planId})`,
      plan: planId,
      period_key: periodKey,
    });

    return { granted: amount, balance: amount };
  });
}

async function ensureClassCounterTx(
  tx: DbTx,
  organizationId: string,
  periodStart: Date,
  klass: AiCreditClass,
) {
  const [row] = await tx
    .select()
    .from(usageClassPeriodCounters)
    .where(
      and(
        eq(usageClassPeriodCounters.organization_id, organizationId),
        eq(usageClassPeriodCounters.period_start, periodStart),
        eq(usageClassPeriodCounters.workload_class, klass),
      ),
    )
    .limit(1)
    .for("update");
  if (row) return row;

  const [inserted] = await tx
    .insert(usageClassPeriodCounters)
    .values({
      organization_id: organizationId,
      period_start: periodStart,
      workload_class: klass,
      used: 0,
      reserved: 0,
      updated_at: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;

  const [again] = await tx
    .select()
    .from(usageClassPeriodCounters)
    .where(
      and(
        eq(usageClassPeriodCounters.organization_id, organizationId),
        eq(usageClassPeriodCounters.period_start, periodStart),
        eq(usageClassPeriodCounters.workload_class, klass),
      ),
    )
    .limit(1)
    .for("update");
  return again!;
}

/**
 * Soft gate before a turn starts. Blocks Free when included credits are gone.
 * Paid plans with on-demand continue (metered overage).
 */
export async function assertCanStartAiTurn(organizationId: string): Promise<{
  balance: number;
  reserved: number;
  available: number;
  onDemandEnabled: boolean;
}> {
  const [[sub], [reservation]] = await Promise.all([
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organization_id, organizationId))
      .limit(1),
    db
      .select({
        reserved: sql<number>`coalesce(sum(${usageRequestReservations.credits}), 0)::int`,
      })
      .from(usageRequestReservations)
      .innerJoin(
        subscriptions,
        and(
          eq(
            subscriptions.organization_id,
            usageRequestReservations.organization_id,
          ),
          eq(
            subscriptions.current_period_start,
            usageRequestReservations.period_start,
          ),
        ),
      )
      .where(
        and(
          eq(usageRequestReservations.organization_id, organizationId),
          eq(usageRequestReservations.status, "reserved"),
        ),
      ),
  ]);

  if (!sub) {
    throw new Error("Subscription missing for credit preflight");
  }

  const balance = Number(sub.ai_credits_balance);
  const reserved = Math.max(0, Number(reservation?.reserved ?? 0));
  const available = Math.max(0, balance - reserved);
  const planId = normalizePlanId(sub.plan);
  const onDemandEnabled = getPlanEntitlements(planId).onDemandBilling;
  if (available <= 0 && !onDemandEnabled) {
    throw new ApiAuthError(
      "usage_exceeded",
      "Included AI credits exhausted. Upgrade to continue.",
      402,
      { blocked: "credits" },
    );
  }

  return { balance, reserved, available, onDemandEnabled };
}

function requestChargeIds(requestId: string): string[] {
  return creditRequestChargeIds(requestId);
}

/** Ledger request_id values that belong to one chat turn (included + overage). */
export function creditRequestChargeIds(requestId: string): string[] {
  return [requestId, `${requestId}:on_demand`];
}

/**
 * Preserve already-consumed credits when applying a new period grant
 * (matches migration `0072_shared_wallet_1_2_8`).
 */
export function migratePreservedCreditBalance(input: {
  oldGranted: number;
  oldBalance: number;
  newGrant: number;
}): { granted: number; balance: number; consumed: number } {
  const consumed = Math.max(0, Math.floor(input.oldGranted) - Math.floor(input.oldBalance));
  const granted = Math.max(0, Math.floor(input.newGrant));
  return {
    granted,
    consumed,
    balance: Math.max(0, granted - consumed),
  };
}

/**
 * Split a settled class charge across included balance vs on-demand overage.
 */
export function splitCreditSettlement(input: {
  credits: number;
  balance: number;
  onDemandEnabled: boolean;
  reservationBillingMode: "included" | "on_demand";
}): {
  includedCharged: number;
  onDemandCharged: number;
  overshootShortfall: number;
} {
  const credits = Math.max(0, Math.floor(input.credits));
  const balance = Math.max(0, Math.floor(input.balance));
  if (credits <= 0) {
    return { includedCharged: 0, onDemandCharged: 0, overshootShortfall: 0 };
  }
  if (input.reservationBillingMode === "on_demand" || balance <= 0) {
    if (input.onDemandEnabled) {
      return {
        includedCharged: 0,
        onDemandCharged: credits,
        overshootShortfall: 0,
      };
    }
    return {
      includedCharged: 0,
      onDemandCharged: 0,
      overshootShortfall: credits,
    };
  }
  const includedCharged = Math.min(credits, balance);
  const remainder = credits - includedCharged;
  return {
    includedCharged,
    onDemandCharged: input.onDemandEnabled ? remainder : 0,
    overshootShortfall: input.onDemandEnabled ? 0 : remainder,
  };
}

/**
 * Atomically reserve credits for the highest affordable class on the
 * Complex → Standard → Simple ladder. Idempotent per org+requestId.
 */
export async function reserveCreditsForRequest(input: {
  organizationId: string;
  requestId: string;
  requestedClass: AiCreditClass;
  billable?: boolean;
}): Promise<{
  decision: AffordableWorkloadDecision;
  credits: number;
  billingMode: "included" | "on_demand";
  duplicate: boolean;
  alreadyCharged: boolean;
  blocked: boolean;
}> {
  const billable = input.billable !== false;

  return db.transaction(async (tx) => {
    const charged = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.organization_id, input.organizationId),
          inArray(creditLedger.request_id, requestChargeIds(input.requestId)),
          sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
        ),
      )
      .limit(1);
    if (charged.length > 0) {
      return {
        decision: {
          requestedClass: input.requestedClass,
          effectiveClass: input.requestedClass,
          downgradedFrom: null,
          reason: "none" as const,
          billingMode: "included" as const,
          reservedCredits: 0,
          availableCredits: 0,
        },
        credits: 0,
        billingMode: "included" as const,
        duplicate: true,
        alreadyCharged: true,
        blocked: false,
      };
    }

    const [existing] = await tx
      .select()
      .from(usageRequestReservations)
      .where(
        and(
          eq(usageRequestReservations.organization_id, input.organizationId),
          eq(usageRequestReservations.request_id, input.requestId),
        ),
      )
      .limit(1)
      .for("update");

    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organization_id, input.organizationId))
      .limit(1)
      .for("update");

    if (!sub) {
      throw new Error("Subscription missing for credit reservation");
    }

    const balance = Number(sub.ai_credits_balance);
    const periodStart = sub.current_period_start ?? new Date();
    const [reservationTotal] = await tx
      .select({
        reserved: sql<number>`coalesce(sum(${usageRequestReservations.credits}), 0)::int`,
      })
      .from(usageRequestReservations)
      .where(
        and(
          eq(usageRequestReservations.organization_id, input.organizationId),
          eq(usageRequestReservations.status, "reserved"),
          eq(usageRequestReservations.period_start, periodStart),
        ),
      );
    const reserved = Math.max(0, Number(reservationTotal?.reserved ?? 0));
    const planId = normalizePlanId(sub.plan);
    const onDemandEnabled = getPlanEntitlements(planId).onDemandBilling;

    if (existing && existing.status === "reserved") {
      const effective = workloadClassOrDefault(existing.workload_class);
      const available = Math.max(0, balance - reserved);
      return {
        decision: {
          requestedClass: input.requestedClass,
          effectiveClass: effective,
          downgradedFrom:
            effective === input.requestedClass ? null : input.requestedClass,
          reason:
            effective === input.requestedClass
              ? ("none" as const)
              : ("insufficient_credits" as const),
          billingMode:
            existing.billing_mode === "on_demand"
              ? ("on_demand" as const)
              : ("included" as const),
          reservedCredits: Number(existing.credits),
          availableCredits: available,
        },
        credits: Number(existing.credits),
        billingMode:
          existing.billing_mode === "on_demand"
            ? ("on_demand" as const)
            : ("included" as const),
        duplicate: true,
        alreadyCharged: false,
        blocked: false,
      };
    }

    if (existing && existing.status === "charged") {
      return {
        decision: {
          requestedClass: input.requestedClass,
          effectiveClass: workloadClassOrDefault(existing.workload_class),
          downgradedFrom: null,
          reason: "none" as const,
          billingMode:
            existing.billing_mode === "on_demand"
              ? ("on_demand" as const)
              : ("included" as const),
          reservedCredits: 0,
          availableCredits: Math.max(0, balance - reserved),
        },
        credits: 0,
        billingMode:
          existing.billing_mode === "on_demand"
            ? ("on_demand" as const)
            : ("included" as const),
        duplicate: true,
        alreadyCharged: true,
        blocked: false,
      };
    }

    // Released or missing → create / refresh reservation.
    if (existing?.status === "released" && Number(existing.credits) > 0) {
      // Already released; do not double-count prior hold.
    }

    const available = Math.max(0, balance - reserved);
    const counterRows = await tx
      .select({
        workloadClass: usageClassPeriodCounters.workload_class,
        used: usageClassPeriodCounters.used,
      })
      .from(usageClassPeriodCounters)
      .where(
        and(
          eq(usageClassPeriodCounters.organization_id, input.organizationId),
          eq(usageClassPeriodCounters.period_start, periodStart),
        ),
      );
    const activeReservations = await tx
      .select({
        workloadClass: usageRequestReservations.workload_class,
        count: sql<number>`count(*)::int`,
      })
      .from(usageRequestReservations)
      .where(
        and(
          eq(usageRequestReservations.organization_id, input.organizationId),
          eq(usageRequestReservations.period_start, periodStart),
          eq(usageRequestReservations.status, "reserved"),
        ),
      )
      .groupBy(usageRequestReservations.workload_class);
    const classUsage: Record<AiCreditClass, number> = {
      simple: 0,
      standard: 0,
      complex: 0,
    };
    for (const row of counterRows) {
      classUsage[workloadClassOrDefault(row.workloadClass)] += Number(row.used);
    }
    for (const row of activeReservations) {
      classUsage[workloadClassOrDefault(row.workloadClass)] += Number(row.count);
    }
    const decision = resolveClassLimitedWorkload({
      requestedClass: input.requestedClass,
      used: classUsage,
      limits: classQuotasForPlan(planId),
      availableCredits: available,
      onDemandEnabled,
      billable,
    });

    if (
      billable &&
      decision.billingMode === "included" &&
      decision.reservedCredits <= 0 &&
      available < creditsForClass("simple") &&
      !onDemandEnabled
    ) {
      throw new ApiAuthError(
        "usage_exceeded",
        "Included AI credits exhausted. Upgrade to continue.",
        402,
        { blocked: "credits" },
      );
    }

    const row = {
      organization_id: input.organizationId,
      request_id: input.requestId,
      workload_class: decision.effectiveClass,
      credits: decision.reservedCredits,
      billing_mode: decision.billingMode,
      status: "reserved" as const,
      period_start: periodStart,
      updated_at: new Date(),
    };

    if (existing) {
      await tx
        .update(usageRequestReservations)
        .set(row)
        .where(eq(usageRequestReservations.id, existing.id));
    } else {
      await tx.insert(usageRequestReservations).values(row);
    }

    return {
      decision,
      credits: decision.reservedCredits,
      billingMode: decision.billingMode,
      duplicate: false,
      alreadyCharged: false,
      blocked: false,
    };
  });
}

/** Release an unused reservation (failed / undelivered turns). */
export async function releaseCreditReservation(input: {
  organizationId: string;
  requestId: string;
}): Promise<{ released: boolean }> {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(usageRequestReservations)
      .where(
        and(
          eq(usageRequestReservations.organization_id, input.organizationId),
          eq(usageRequestReservations.request_id, input.requestId),
        ),
      )
      .limit(1)
      .for("update");

    if (!reservation || reservation.status !== "reserved") {
      return { released: false };
    }

    await tx
      .update(usageRequestReservations)
      .set({ status: "released", updated_at: new Date() })
      .where(eq(usageRequestReservations.id, reservation.id));

    return { released: true };
  });
}

async function debitCreditsForRequestTx(
  tx: DbTx,
  input: {
    organizationId: string;
    requestId: string;
    credits: number;
    complexityClass: AiCreditClass;
    reason: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{
  charged: number;
  includedCharged: number;
  onDemandCharged: number;
  balanceAfter: number;
  duplicate: boolean;
  overshootShortfall: number;
  reservationReleased: boolean;
}> {
  const credits = Math.min(
    MAX_CREDITS_PER_REQUEST,
    Math.max(0, Math.floor(input.credits)),
  );

  const existingRows = await tx
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organization_id, input.organizationId),
        inArray(creditLedger.request_id, requestChargeIds(input.requestId)),
        sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
      ),
    );
  if (existingRows.length > 0) {
    const tallied = tallyRequestCreditCharges(existingRows)!;
    return {
      ...tallied,
      duplicate: true,
      overshootShortfall: 0,
      reservationReleased: false,
    };
  }

  const [reservation] = await tx
    .select()
    .from(usageRequestReservations)
    .where(
      and(
        eq(usageRequestReservations.organization_id, input.organizationId),
        eq(usageRequestReservations.request_id, input.requestId),
      ),
    )
    .limit(1)
    .for("update");

  const [sub] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, input.organizationId))
    .limit(1)
    .for("update");

  if (!sub) {
    throw new Error("Subscription missing for credit ledger write");
  }

  const raced = await tx
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organization_id, input.organizationId),
        inArray(creditLedger.request_id, requestChargeIds(input.requestId)),
        sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
      ),
    );
  if (raced.length > 0) {
    const tallied = tallyRequestCreditCharges(raced)!;
    return {
      ...tallied,
      duplicate: true,
      overshootShortfall: 0,
      reservationReleased: false,
    };
  }

  const balance = Number(sub.ai_credits_balance);
  const hold =
    reservation?.status === "reserved"
      ? Math.max(0, Number(reservation.credits))
      : 0;
  const planId = normalizePlanId(sub.plan);
  const onDemandEnabled = getPlanEntitlements(planId).onDemandBilling;
  const reservationBillingMode =
    reservation?.billing_mode === "on_demand" ? "on_demand" : "included";

  const {
    includedCharged,
    onDemandCharged,
    overshootShortfall,
  } = splitCreditSettlement({
    credits,
    balance,
    onDemandEnabled,
    reservationBillingMode,
  });

  const nextBalance = balance - includedCharged;

  await tx
    .update(subscriptions)
    .set({
      ai_credits_balance: nextBalance,
      updated_at: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  if (reservation && reservation.status === "reserved") {
    await tx
      .update(usageRequestReservations)
      .set({ status: "charged", updated_at: new Date() })
      .where(eq(usageRequestReservations.id, reservation.id));
  }

  try {
    if (includedCharged > 0) {
      await tx.insert(creditLedger).values({
        organization_id: input.organizationId,
        entry_type: "ai_consumption",
        amount: -includedCharged,
        balance_after: nextBalance,
        reason: input.reason,
        request_id: input.requestId,
        plan: sub.plan,
      });
    }
    if (onDemandCharged > 0) {
      await tx.insert(creditLedger).values({
        organization_id: input.organizationId,
        entry_type: "ai_on_demand",
        amount: -onDemandCharged,
        balance_after: nextBalance,
        reason: input.reason,
        request_id:
          includedCharged > 0
            ? `${input.requestId}:on_demand`
            : input.requestId,
        plan: sub.plan,
      });
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const dup = await tx
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.organization_id, input.organizationId),
          inArray(creditLedger.request_id, requestChargeIds(input.requestId)),
          sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
        ),
      );
    if (dup.length > 0) {
      const tallied = tallyRequestCreditCharges(dup)!;
      return {
        ...tallied,
        duplicate: true,
        overshootShortfall: 0,
        reservationReleased: hold > 0,
      };
    }
    throw error;
  }

  return {
    charged: includedCharged + onDemandCharged,
    includedCharged,
    onDemandCharged,
    balanceAfter: nextBalance,
    duplicate: false,
    overshootShortfall,
    reservationReleased: hold > 0 || Boolean(reservation),
  };
}

async function incrementClassUsedTx(
  tx: DbTx,
  organizationId: string,
  klass: AiCreditClass,
): Promise<void> {
  const [sub] = await tx
    .select({
      currentPeriodStart: subscriptions.current_period_start,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);

  const periodStart = sub?.currentPeriodStart ?? new Date();
  const counter = await ensureClassCounterTx(
    tx,
    organizationId,
    periodStart,
    klass,
  );

  await tx
    .update(usageClassPeriodCounters)
    .set({
      used: Number(counter.used) + 1,
      reserved: 0,
      updated_at: new Date(),
    })
    .where(eq(usageClassPeriodCounters.id, counter.id));
}

export async function refundCreditsForRequest(input: {
  organizationId: string;
  requestId: string;
  reason: string;
}): Promise<{ refunded: number; balanceAfter: number } | null> {
  const refundRequestId = `${input.requestId}:refund`;
  const [existingRefund] = await db
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organization_id, input.organizationId),
        eq(creditLedger.request_id, refundRequestId),
        eq(creditLedger.entry_type, "refund"),
      ),
    )
    .limit(1);
  if (existingRefund) {
    return {
      refunded: Number(existingRefund.amount),
      balanceAfter: Number(existingRefund.balance_after),
    };
  }

  const consumeRows = await db
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organization_id, input.organizationId),
        inArray(creditLedger.request_id, requestChargeIds(input.requestId)),
        sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
      ),
    );
  if (consumeRows.length === 0) return null;
  return db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organization_id, input.organizationId))
      .limit(1)
      .for("update");
    if (!sub) throw new Error("Subscription missing for credit refund");
    // Only refund included consumption back to the wallet; on-demand was
    // provider-metered and is tracked separately.
    const includedRefund = consumeRows
      .filter((row) => row.entry_type === "ai_consumption")
      .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
    const next = Number(sub.ai_credits_balance) + includedRefund;
    await tx
      .update(subscriptions)
      .set({ ai_credits_balance: next, updated_at: new Date() })
      .where(eq(subscriptions.id, sub.id));
    await tx.insert(creditLedger).values({
      organization_id: input.organizationId,
      entry_type: "refund",
      amount: includedRefund,
      balance_after: next,
      reason: input.reason,
      request_id: refundRequestId,
    });
    return { refunded: includedRefund, balanceAfter: next };
  });
}

export async function sumUsageEventsForRequest(
  organizationId: string,
  requestId: string,
): Promise<{
  inputTokens: number;
  outputTokens: number;
  providerCostMicros: number | null;
  pricingStatus: "verified" | "unknown" | "mixed";
  modelServices: string[];
  toolServices: string[];
}> {
  const rows = await db
    .select()
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organization_id, organizationId),
        eq(usageEvents.request_id, requestId),
      ),
    );

  let inputTokens = 0;
  let outputTokens = 0;
  let costSum = 0;
  let costKnown = 0;
  let costUnknown = 0;
  const modelServices: string[] = [];
  const toolServices: string[] = [];

  for (const r of rows) {
    inputTokens += Number(r.input_tokens ?? 0);
    outputTokens += Number(r.output_tokens ?? 0);
    if (r.provider_cost_micros != null) {
      costSum += Number(r.provider_cost_micros);
      costKnown += 1;
    } else {
      costUnknown += 1;
    }
    if (r.resource_type === "model") modelServices.push(r.service);
    if (r.resource_type === "tool") toolServices.push(r.service);
  }

  return {
    inputTokens,
    outputTokens,
    providerCostMicros: costKnown > 0 ? costSum : null,
    pricingStatus:
      costUnknown === 0 && costKnown > 0
        ? "verified"
        : costKnown === 0
          ? "unknown"
          : "mixed",
    modelServices,
    toolServices,
  };
}

/**
 * Finalize a chat request after delivery. No response → charge 0.
 * Class and credits come from observed usage, not a pre-charge guess.
 */
export async function finalizeAiCreditRequest(input: {
  organizationId: string;
  requestId: string;
  apiKeyId?: string | null;
  threadId?: string | null;
  agentId?: string | null;
  signals: TurnCreditSignals;
  delivered?: boolean;
}): Promise<{
  complexityClass: AiCreditClass;
  creditsCharged: number;
  balanceAfter: number;
  duplicate: boolean;
  rollupId: string | null;
  released: boolean;
}> {
  const [existingRollup] = await db
    .select()
    .from(usageRequestRollups)
    .where(
      and(
        eq(usageRequestRollups.organization_id, input.organizationId),
        eq(usageRequestRollups.request_id, input.requestId),
      ),
    )
    .limit(1);

  if (existingRollup) {
    const credits = await getCreditBalance(input.organizationId);
    return {
      complexityClass: workloadClassOrDefault(existingRollup.complexity_class),
      creditsCharged: Number(existingRollup.credits_charged),
      balanceAfter: credits.balance,
      duplicate: true,
      rollupId: existingRollup.id,
      released: false,
    };
  }

  if (!input.delivered) {
    const released = await releaseCreditReservation({
      organizationId: input.organizationId,
      requestId: input.requestId,
    });
    const credits = await getCreditBalance(input.organizationId);
    const classified = classifyAiCreditClass(input.signals);
    return {
      complexityClass: classified.complexityClass,
      creditsCharged: 0,
      balanceAfter: credits.balance,
      duplicate: false,
      rollupId: null,
      released: released.released,
    };
  }

  const classified = classifyAiCreditClass(input.signals);
  const usage = await sumUsageEventsForRequest(
    input.organizationId,
    input.requestId,
  );
  const actualTools = [...new Set(input.signals.toolsUsed)];

  const chargeInput = {
    organizationId: input.organizationId,
    requestId: input.requestId,
    credits: classified.credits,
    complexityClass: classified.complexityClass,
    reason: classified.reason,
  };

  return db.transaction(async (tx) => {
    const charge = await debitCreditsForRequestTx(tx, chargeInput);

    const [rollup] = await tx
      .insert(usageRequestRollups)
      .values({
        organization_id: input.organizationId,
        request_id: input.requestId,
        api_key_id: input.apiKeyId ?? null,
        thread_id: input.threadId ?? null,
        agent_id: input.agentId ?? null,
        complexity_class: classified.complexityClass,
        credits_charged: classified.credits,
        routed_model: input.signals.routedModel ?? null,
        complexity_tier: input.signals.complexityTier ?? null,
        route_source: input.signals.routeSource ?? null,
        agent_rounds: input.signals.agentRounds,
        tool_calls: input.signals.toolsUsed.length,
        tools_used: actualTools,
        semantic_search_count: input.signals.semanticSearchCount,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        provider_cost_micros: usage.providerCostMicros,
        pricing_status: usage.pricingStatus,
        capped: Boolean(input.signals.capped),
        cap_reason: input.signals.capReason ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!rollup) {
      const [again] = await tx
        .select()
        .from(usageRequestRollups)
        .where(
          and(
            eq(usageRequestRollups.organization_id, input.organizationId),
            eq(usageRequestRollups.request_id, input.requestId),
          ),
        )
        .limit(1);
      return {
        complexityClass: workloadClassOrDefault(again?.complexity_class),
        creditsCharged: Number(again?.credits_charged ?? charge.charged),
        balanceAfter: charge.balanceAfter,
        duplicate: true,
        rollupId: again?.id ?? null,
        released: charge.reservationReleased,
      };
    }

    if (classified.credits > 0) {
      await incrementClassUsedTx(
        tx,
        input.organizationId,
        classified.complexityClass,
      );
    }

    return {
      complexityClass: classified.complexityClass,
      creditsCharged: classified.credits,
      balanceAfter: charge.balanceAfter,
      duplicate: charge.duplicate,
      rollupId: rollup.id,
      released: charge.reservationReleased,
    };
  });
}

export async function getOrgClassUsage(
  organizationId: string,
  plan?: string | null,
): Promise<{
  planId: PlanId;
  periodStart: Date;
  workloads: Record<AiCreditClass, WorkloadMeter>;
}> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);
  const planId = normalizePlanId(plan ?? sub?.plan);
  const quotas = classQuotasForPlan(planId);
  const periodStart =
    sub?.current_period_start ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [rows, reservationRows] = await Promise.all([
    db
      .select()
      .from(usageClassPeriodCounters)
      .where(
        and(
          eq(usageClassPeriodCounters.organization_id, organizationId),
          eq(usageClassPeriodCounters.period_start, periodStart),
        ),
      ),
    db
      .select({
        workloadClass: usageRequestReservations.workload_class,
        count: sql<number>`count(*)::int`,
      })
      .from(usageRequestReservations)
      .where(
        and(
          eq(usageRequestReservations.organization_id, organizationId),
          eq(usageRequestReservations.period_start, periodStart),
          eq(usageRequestReservations.status, "reserved"),
        ),
      )
      .groupBy(usageRequestReservations.workload_class),
  ]);
  const reservedByClass: Record<AiCreditClass, number> = {
    simple: 0,
    standard: 0,
    complex: 0,
  };
  for (const row of reservationRows) {
    reservedByClass[workloadClassOrDefault(row.workloadClass)] = Number(
      row.count,
    );
  }

  const byClass = Object.fromEntries(
    AI_CREDIT_CLASSES.map((klass) => [
      klass,
      meterFrom(0, quotas[klass], reservedByClass[klass], true),
    ]),
  ) as Record<AiCreditClass, WorkloadMeter>;

  for (const row of rows) {
    const klass = workloadClassOrDefault(row.workload_class);
    byClass[klass] = meterFrom(
      Number(row.used),
      quotas[klass],
      reservedByClass[klass],
      true,
    );
  }

  return { planId, periodStart, workloads: byClass };
}

export function blockedFromMeters(input: {
  creditsRemaining: number;
  workloads: Record<AiCreditClass, WorkloadMeter>;
}): { reason: CreditBlockReason } | null {
  if (input.creditsRemaining <= 0) return { reason: "credits" };
  return null;
}

export async function getOrgCreditSummary(organizationId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);

  const balance = Number(sub?.ai_credits_balance ?? 0);
  const planId = normalizePlanId(sub?.plan);
  const granted = getPlanEntitlements(planId).aiCreditsPerMonth;
  const since =
    sub?.current_period_start ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [reservationRow] = await db
    .select({
      reserved: sql<number>`coalesce(sum(${usageRequestReservations.credits}), 0)::int`,
    })
    .from(usageRequestReservations)
    .where(
      and(
        eq(usageRequestReservations.organization_id, organizationId),
        eq(usageRequestReservations.status, "reserved"),
        eq(usageRequestReservations.period_start, since),
      ),
    );
  const reserved = Math.max(0, Number(reservationRow?.reserved ?? 0));
  const used = Math.max(0, granted - balance);

  const classUsage = await getOrgClassUsage(organizationId, planId);
  const onDemandEnabled = getPlanEntitlements(planId).onDemandBilling;

  const [onDemandRow] = await db
    .select({
      credits: sql<number>`coalesce(sum(abs(${creditLedger.amount})), 0)::int`,
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organization_id, organizationId),
        eq(creditLedger.entry_type, "ai_on_demand"),
        gte(creditLedger.created_at, since),
      ),
    );
  const onDemandUsed = Number(onDemandRow?.credits ?? 0);

  const classRows = await db
    .select({
      complexityClass: usageRequestRollups.complexity_class,
      n: sql<number>`count(*)::int`,
      credits: sql<number>`coalesce(sum(${usageRequestRollups.credits_charged}), 0)::int`,
    })
    .from(usageRequestRollups)
    .where(
      and(
        eq(usageRequestRollups.organization_id, organizationId),
        gte(usageRequestRollups.created_at, since),
      ),
    )
    .groupBy(usageRequestRollups.complexity_class);

  const byClassMap = new Map<AiCreditClass, { conversations: number; credits: number }>();
  for (const klass of AI_CREDIT_CLASSES) {
    byClassMap.set(klass, { conversations: 0, credits: 0 });
  }
  for (const row of classRows) {
    const klass = workloadClassOrDefault(row.complexityClass);
    const cur = byClassMap.get(klass)!;
    cur.conversations += Number(row.n);
    cur.credits += Number(row.credits);
  }

  const [turnRow] = await db
    .select({
      n: sql<number>`count(*)::int`,
      avgCredits: sql<number>`coalesce(avg(${usageRequestRollups.credits_charged}), 0)`,
    })
    .from(usageRequestRollups)
    .where(
      and(
        eq(usageRequestRollups.organization_id, organizationId),
        gte(usageRequestRollups.created_at, since),
      ),
    );

  const creditMeter = meterFrom(used, granted > 0 ? granted : getPlanEntitlements(planId).aiCreditsPerMonth);
  const blocked = blockedFromMeters({
    creditsRemaining: onDemandEnabled
      ? Number.POSITIVE_INFINITY
      : Math.max(0, balance),
    workloads: classUsage.workloads,
  });

  return {
    balance,
    reserved,
    available: Math.max(0, balance - reserved),
    granted: creditMeter.limit,
    used,
    includedUsed: used,
    onDemandUsed,
    totalUsed: used + onDemandUsed,
    onDemandEnabled,
    conversations: Number(turnRow?.n ?? 0),
    averageCreditsPerConversation: Number(turnRow?.avgCredits ?? 0),
    byClass: AI_CREDIT_CLASSES.map((klass) => ({
      complexityClass: klass,
      conversations: byClassMap.get(klass)?.conversations ?? 0,
      credits: byClassMap.get(klass)?.credits ?? 0,
    })),
    workloads: classUsage.workloads,
    creditMeter: {
      ...creditMeter,
      ok: creditMeter.ok || onDemandEnabled,
      includedExhausted: !creditMeter.ok,
    },
    blocked,
    policy: {
      classQueryLimits: classQuotasForPlan(planId),
      oneWayBorrowing: true as const,
      exhaustedClassFallback: "simple" as const,
      sharedWallet: true as const,
      creditCosts: AI_CREDIT_COSTS,
      affordabilityDowngrade: false as const,
      postDeliveryCharge: true as const,
      onDemand: onDemandEnabled,
      onDemandScope: "credits_only" as const,
    },
    periodStart: since,
    planId,
  };
}

export async function listRecentCreditLedger(
  organizationId: string,
  limit = 50,
) {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.organization_id, organizationId))
    .orderBy(desc(creditLedger.created_at))
    .limit(limit);
}

export async function getCreditUsageTrend(
  organizationId: string,
  days = 30,
): Promise<Array<{ date: string; credits: number; conversations: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${usageRequestRollups.created_at}), 'YYYY-MM-DD')`,
      credits: sql<number>`coalesce(sum(${usageRequestRollups.credits_charged}), 0)::int`,
      conversations: sql<number>`count(*)::int`,
    })
    .from(usageRequestRollups)
    .where(
      and(
        eq(usageRequestRollups.organization_id, organizationId),
        gte(usageRequestRollups.created_at, since),
      ),
    )
    .groupBy(sql`date_trunc('day', ${usageRequestRollups.created_at})`)
    .orderBy(sql`date_trunc('day', ${usageRequestRollups.created_at})`);

  const byDay = new Map(
    rows.map((r) => [
      r.day,
      { credits: Number(r.credits), conversations: Number(r.conversations) },
    ]),
  );

  const series: Array<{
    date: string;
    credits: number;
    conversations: number;
  }> = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    series.push({
      date: key,
      credits: hit?.credits ?? 0,
      conversations: hit?.conversations ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}
