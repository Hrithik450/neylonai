import { describe, expect, it } from "vitest";
import {
  AI_CREDIT_COSTS,
  blockedFromMeters,
  classifyAiCreditClass,
  creditRequestChargeIds,
  migratePreservedCreditBalance,
  splitCreditSettlement,
} from "./credits";
import { AI_CREDITS_INCLUDED_BY_PLAN } from "./workload-policy";

describe("classifyAiCreditClass", () => {
  it("charges 0 for non-billable social turns", () => {
    const result = classifyAiCreditClass({
      toolsUsed: [],
      agentRounds: 1,
      semanticSearchCount: 0,
      estimate: {
        billable: false,
        estimatedCredits: 0,
        estimatedClass: "simple",
        confidence: 1,
        likelyTools: [],
        expectedSearchRounds: 0,
        expectedToolRounds: 0,
        expectedInputTokensBand: "xs",
        expectedOutputTokensBand: "xs",
        reason: "greeting",
        source: "heuristic",
        estimatorVersion: "test",
      },
    });
    expect(result.credits).toBe(0);
  });

  it("caps observed Complex at effective Simple after downgrade", () => {
    const result = classifyAiCreditClass({
      toolsUsed: ["a", "b", "c", "d"],
      agentRounds: 5,
      semanticSearchCount: 3,
      capped: true,
      workloadClass: "simple",
      estimate: {
        billable: true,
        estimatedCredits: 1,
        estimatedClass: "simple",
        requestedClass: "complex",
        effectiveClass: "simple",
        downgradedFrom: "complex",
        confidence: 0.9,
        likelyTools: [],
        expectedSearchRounds: 0,
        expectedToolRounds: 0,
        expectedInputTokensBand: "m",
        expectedOutputTokensBand: "s",
        reason: "remapped",
        source: "classifier",
        estimatorVersion: "test",
      },
    });
    expect(result.complexityClass).toBe("simple");
    expect(result.credits).toBe(AI_CREDIT_COSTS.simple);
    expect(result.reason).toMatch(/capped at effective simple/);
  });

  it("never upgrades a Standard route to Complex from observation", () => {
    const result = classifyAiCreditClass({
      toolsUsed: ["a", "b", "c", "d"],
      agentRounds: 4,
      semanticSearchCount: 2,
      capped: true,
      workloadClass: "standard",
    });
    expect(result.complexityClass).toBe("standard");
    expect(result.credits).toBe(2);
  });
});

describe("splitCreditSettlement", () => {
  it("charges included only when balance covers the class", () => {
    expect(
      splitCreditSettlement({
        credits: 8,
        balance: 20,
        onDemandEnabled: true,
        reservationBillingMode: "included",
      }),
    ).toEqual({
      includedCharged: 8,
      onDemandCharged: 0,
      overshootShortfall: 0,
    });
  });

  it("splits included + on-demand when balance is partial", () => {
    expect(
      splitCreditSettlement({
        credits: 8,
        balance: 3,
        onDemandEnabled: true,
        reservationBillingMode: "included",
      }),
    ).toEqual({
      includedCharged: 3,
      onDemandCharged: 5,
      overshootShortfall: 0,
    });
  });

  it("records full on-demand when reservation mode is overage", () => {
    expect(
      splitCreditSettlement({
        credits: 8,
        balance: 0,
        onDemandEnabled: true,
        reservationBillingMode: "on_demand",
      }),
    ).toEqual({
      includedCharged: 0,
      onDemandCharged: 8,
      overshootShortfall: 0,
    });
  });

  it("shortfalls Free when balance cannot cover the charge", () => {
    expect(
      splitCreditSettlement({
        credits: 2,
        balance: 0,
        onDemandEnabled: false,
        reservationBillingMode: "included",
      }),
    ).toEqual({
      includedCharged: 0,
      onDemandCharged: 0,
      overshootShortfall: 2,
    });
  });
});

describe("refund / idempotency charge ids", () => {
  it("includes the on_demand suffix for split refunds", () => {
    expect(creditRequestChargeIds("req_123")).toEqual([
      "req_123",
      "req_123:on_demand",
    ]);
  });
});

describe("migratePreservedCreditBalance", () => {
  it("preserves consumed credits when grants increase", () => {
    // Old Business 10k grant with 2k remaining → 8k consumed.
    // New 15k grant → balance 7k.
    expect(
      migratePreservedCreditBalance({
        oldGranted: 10_000,
        oldBalance: 2_000,
        newGrant: AI_CREDITS_INCLUDED_BY_PLAN.business,
      }),
    ).toEqual({ granted: 15_000, consumed: 8_000, balance: 7_000 });
  });

  it("clamps at zero when consumed exceeds the new grant", () => {
    expect(
      migratePreservedCreditBalance({
        oldGranted: 10_000,
        oldBalance: 0,
        newGrant: 500,
      }),
    ).toEqual({ granted: 500, consumed: 10_000, balance: 0 });
  });

  it("leaves unused balances at the full new grant", () => {
    expect(
      migratePreservedCreditBalance({
        oldGranted: 1_000,
        oldBalance: 1_000,
        newGrant: 2_000,
      }),
    ).toEqual({ granted: 2_000, consumed: 0, balance: 2_000 });
  });
});

describe("blockedFromMeters", () => {
  it("blocks only on exhausted shared credits", () => {
    expect(
      blockedFromMeters({
        creditsRemaining: 0,
        workloads: {
          simple: {
            ok: true,
            hardCap: false,
            thresholdExceeded: false,
            used: 0,
            reserved: 0,
            limit: 100,
            remaining: 100,
            percent: 0,
          },
          standard: {
            ok: true,
            hardCap: false,
            thresholdExceeded: true,
            used: 99,
            reserved: 0,
            limit: 100,
            remaining: 1,
            percent: 99,
          },
          complex: {
            ok: true,
            hardCap: false,
            thresholdExceeded: true,
            used: 99,
            reserved: 0,
            limit: 100,
            remaining: 1,
            percent: 99,
          },
        },
      }),
    ).toEqual({ reason: "credits" });

    expect(
      blockedFromMeters({
        creditsRemaining: 1,
        workloads: {
          simple: {
            ok: false,
            hardCap: false,
            thresholdExceeded: true,
            used: 100,
            reserved: 0,
            limit: 100,
            remaining: 0,
            percent: 100,
          },
          standard: {
            ok: false,
            hardCap: false,
            thresholdExceeded: true,
            used: 100,
            reserved: 0,
            limit: 100,
            remaining: 0,
            percent: 100,
          },
          complex: {
            ok: false,
            hardCap: false,
            thresholdExceeded: true,
            used: 100,
            reserved: 0,
            limit: 100,
            remaining: 0,
            percent: 100,
          },
        },
      }),
    ).toBeNull();
  });
});
