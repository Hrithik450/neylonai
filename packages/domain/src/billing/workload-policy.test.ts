import { describe, expect, it } from "vitest";
import {
  AI_CREDIT_COSTS,
  AI_CREDITS_INCLUDED_BY_PLAN,
  PLAN_CLASS_QUOTAS,
  capBillableClass,
  classRank,
  creditsForClass,
  maxWorkloadClass,
  minWorkloadClass,
  resolveAffordableWorkload,
  resolveClassLimitedWorkload,
} from "./workload-policy";

describe("shared wallet policy", () => {
  it("charges Simple 1 · Standard 2 · Complex 8", () => {
    expect(AI_CREDIT_COSTS).toEqual({ simple: 1, standard: 2, complex: 8 });
    expect(creditsForClass("simple")).toBe(1);
    expect(creditsForClass("standard")).toBe(2);
    expect(creditsForClass("complex")).toBe(8);
  });

  it("grants Free 500 · Starter 2k · Pro 5k · Business 15k", () => {
    expect(AI_CREDITS_INCLUDED_BY_PLAN).toEqual({
      free: 500,
      starter: 2_000,
      pro: 5_000,
      business: 15_000,
    });
  });

  it("sets hard Simple / Standard / Complex query limits by plan", () => {
    expect(PLAN_CLASS_QUOTAS).toEqual({
      free: { simple: 100, standard: 50, complex: 20 },
      starter: { simple: 400, standard: 200, complex: 70 },
      pro: { simple: 1_000, standard: 500, complex: 150 },
      business: { simple: 3_000, standard: 1_500, complex: 500 },
    });
  });

  it("trades unused Complex capacity into cheaper classes", () => {
    // One Complex (8) equals 8 Simple or 4 Standard.
    expect(AI_CREDIT_COSTS.complex / AI_CREDIT_COSTS.simple).toBe(8);
    expect(AI_CREDIT_COSTS.complex / AI_CREDIT_COSTS.standard).toBe(4);
  });
});

describe("resolveClassLimitedWorkload", () => {
  const limits = { simple: 100, standard: 50, complex: 20 };

  it("keeps a requested class while its own limit has capacity", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "complex",
        used: { simple: 100, standard: 50, complex: 19 },
        limits,
        availableCredits: 8,
        onDemandEnabled: false,
      }),
    ).toMatchObject({
      effectiveClass: "complex",
      reservedCredits: 8,
      reason: "none",
    });
  });

  it("lets Simple borrow Standard or Complex capacity without rerouting", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "simple",
        used: { simple: 100, standard: 49, complex: 20 },
        limits,
        availableCredits: 1,
        onDemandEnabled: false,
      }),
    ).toMatchObject({
      effectiveClass: "simple",
      reservedCredits: 1,
      reason: "none",
    });
  });

  it("lets Standard borrow only Complex capacity", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "standard",
        used: { simple: 0, standard: 50, complex: 19 },
        limits,
        availableCredits: 2,
        onDemandEnabled: false,
      }),
    ).toMatchObject({
      effectiveClass: "standard",
      reservedCredits: 2,
      reason: "none",
    });
  });

  it("never lets Complex borrow lower-class capacity", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "complex",
        used: { simple: 0, standard: 0, complex: 20 },
        limits,
        availableCredits: 100,
        onDemandEnabled: false,
      }),
    ).toMatchObject({
      effectiveClass: "simple",
      downgradedFrom: "complex",
      reservedCredits: 1,
      reason: "class_limit_fallback",
    });
  });

  it("falls Standard back to Simple when Complex cannot lend", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "standard",
        used: { simple: 0, standard: 50, complex: 20 },
        limits,
        availableCredits: 100,
        onDemandEnabled: false,
      }),
    ).toMatchObject({
      effectiveClass: "simple",
      downgradedFrom: "standard",
      reservedCredits: 1,
      reason: "class_limit_fallback",
    });
  });

  it("requires enough included credits for upward borrowing", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "standard",
        used: { simple: 0, standard: 50, complex: 0 },
        limits,
        availableCredits: 1,
        onDemandEnabled: true,
      }),
    ).toMatchObject({
      effectiveClass: "simple",
      billingMode: "included",
      reservedCredits: 1,
    });
  });

  it("uses Simple limits when a higher class cannot be fully funded", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "complex",
        used: { simple: 0, standard: 0, complex: 0 },
        limits,
        availableCredits: 2,
        onDemandEnabled: true,
      }),
    ).toMatchObject({
      effectiveClass: "simple",
      billingMode: "included",
      reservedCredits: 1,
      reason: "class_limit_fallback",
    });
  });

  it("keeps the requested class as paid overage at zero credits when under limit", () => {
    expect(
      resolveClassLimitedWorkload({
        requestedClass: "complex",
        used: { simple: 0, standard: 0, complex: 0 },
        limits,
        availableCredits: 0,
        onDemandEnabled: true,
      }),
    ).toMatchObject({
      effectiveClass: "complex",
      billingMode: "on_demand",
      reservedCredits: 0,
      reason: "on_demand_passthrough",
    });
  });
});

describe("resolveAffordableWorkload", () => {
  it("keeps Complex when 8+ credits are available", () => {
    const d = resolveAffordableWorkload({
      requestedClass: "complex",
      availableCredits: 8,
      onDemandEnabled: false,
    });
    expect(d).toMatchObject({
      effectiveClass: "complex",
      downgradedFrom: null,
      billingMode: "included",
      reservedCredits: 8,
      reason: "none",
    });
  });

  it("downgrades Complex→Standard when 2–7 credits remain", () => {
    for (const available of [2, 3, 7]) {
      const d = resolveAffordableWorkload({
        requestedClass: "complex",
        availableCredits: available,
        onDemandEnabled: false,
      });
      expect(d.effectiveClass).toBe("standard");
      expect(d.downgradedFrom).toBe("complex");
      expect(d.reservedCredits).toBe(2);
      expect(d.billingMode).toBe("included");
    }
  });

  it("downgrades Complex→Simple when only 1 credit remains", () => {
    const d = resolveAffordableWorkload({
      requestedClass: "complex",
      availableCredits: 1,
      onDemandEnabled: false,
    });
    expect(d).toMatchObject({
      effectiveClass: "simple",
      downgradedFrom: "complex",
      reservedCredits: 1,
      billingMode: "included",
    });
  });

  it("blocks Free at zero balance (no affordable class)", () => {
    const d = resolveAffordableWorkload({
      requestedClass: "complex",
      availableCredits: 0,
      onDemandEnabled: false,
    });
    expect(d.reservedCredits).toBe(0);
    expect(d.reason).toBe("insufficient_credits");
    expect(d.billingMode).toBe("included");
  });

  it("runs requested class as on-demand when paid and balance is 0", () => {
    const d = resolveAffordableWorkload({
      requestedClass: "complex",
      availableCredits: 0,
      onDemandEnabled: true,
    });
    expect(d).toMatchObject({
      effectiveClass: "complex",
      downgradedFrom: null,
      billingMode: "on_demand",
      reservedCredits: 0,
      reason: "on_demand_passthrough",
    });
  });

  it("does not reserve credits for non-billable turns", () => {
    const d = resolveAffordableWorkload({
      requestedClass: "complex",
      availableCredits: 0,
      onDemandEnabled: false,
      billable: false,
    });
    expect(d.reservedCredits).toBe(0);
    expect(d.reason).toBe("none");
    expect(d.effectiveClass).toBe("complex");
  });

  it("downgrades Standard→Simple at 1 credit", () => {
    const d = resolveAffordableWorkload({
      requestedClass: "standard",
      availableCredits: 1,
      onDemandEnabled: false,
    });
    expect(d.effectiveClass).toBe("simple");
    expect(d.downgradedFrom).toBe("standard");
  });
});

describe("capBillableClass and ordering", () => {
  it("never bills above the effective route", () => {
    expect(capBillableClass("complex", "simple")).toBe("simple");
    expect(capBillableClass("complex", "standard")).toBe("standard");
    expect(capBillableClass("standard", "complex")).toBe("standard");
    expect(capBillableClass("simple", null)).toBe("simple");
  });

  it("orders classes by cost rank", () => {
    expect(classRank("simple")).toBeLessThan(classRank("standard"));
    expect(classRank("standard")).toBeLessThan(classRank("complex"));
    expect(minWorkloadClass("complex", "simple")).toBe("simple");
    expect(maxWorkloadClass("complex", "simple")).toBe("complex");
  });
});
