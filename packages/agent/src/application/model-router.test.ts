import { describe, expect, it } from "vitest";
import {
  applyAffordabilityToRoute,
  buildEstimatorUserMessage,
  buildFallbackRoute,
  buildHeuristicRoute,
  parseCreditClassifierDecision,
  routeFromClass,
} from "./model-router";
import { emptyOrgWorkloadSummary } from "@neylonai/domain/billing";
import { prompts } from "../lib/prompts";

const tools = [
  { name: "semantic_search", estimatedUsdPerCall: 0, pricingStatus: "verified" as const },
  { name: "web_search", estimatedUsdPerCall: 0.008, pricingStatus: "verified" as const },
];

describe("parseCreditClassifierDecision", () => {
  it("validates workload class and keeps only available tool names", () => {
    const route = parseCreditClassifierDecision(
      JSON.stringify({
        billable: true,
        workload: "standard",
        likelyTools: ["semantic_search", "drop_table", "web_search"],
        expectedSearchRounds: 1,
        expectedToolRounds: 1,
        expectedInputTokensBand: "s",
        expectedOutputTokensBand: "s",
        confidence: 0.81,
        reason: "Typical product question with a cheap lookup",
      }),
      ["semantic_search", "web_search"],
    );
    expect(route).not.toBeNull();
    expect(route?.complexity).toBe("medium");
    expect(route?.workloadClass).toBe("standard");
    expect(route?.estimatedCredits).toBe(2);
    expect(route?.estimatedClass).toBe("standard");
    expect(route?.likelyTools).toEqual(["semantic_search", "web_search"]);
    expect(route?.source).toBe("classifier");
  });

  it("accepts complexity aliases and ignores invalid credit numbers", () => {
    const route = parseCreditClassifierDecision(
      JSON.stringify({
        billable: true,
        complexity: "high",
        estimatedCredits: 99,
      }),
      ["semantic_search"],
    );
    expect(route?.workloadClass).toBe("complex");
    expect(route?.estimatedCredits).toBe(8);
  });

  it("rejects missing workload", () => {
    expect(
      parseCreditClassifierDecision(
        JSON.stringify({ estimatedCredits: 1 }),
        [],
      ),
    ).toBeNull();
  });

  it("clamps rounds to the class budget", () => {
    const route = parseCreditClassifierDecision(
      JSON.stringify({
        billable: true,
        workload: "complex",
        expectedSearchRounds: 99,
        expectedToolRounds: 99,
        confidence: 4,
        likelyTools: ["semantic_search"],
        reason: "too much",
      }),
      ["semantic_search"],
    );
    expect(route?.expectedSearchRounds).toBe(2);
    expect(route?.expectedToolRounds).toBe(2);
    expect(route?.confidence).toBe(1);
  });
});

describe("buildEstimatorUserMessage", () => {
  it("includes size metadata and tool names, never raw content or secrets", () => {
    const message = buildEstimatorUserMessage({
      question: "What does the pricing page say?",
      availableTools: tools,
      workload: {
        ...emptyOrgWorkloadSummary(),
        sourceCount: 1,
        documentCount: 6,
        chunkCount: 40,
        rawContentBytes: 100_000,
        enabledCapabilityIds: ["website"],
      },
      conversation: {
        messageCount: 2,
        characterCount: 80,
        queryCharacterCount: 32,
      },
    });
    expect(message).toContain("98 KB");
    expect(message).toContain("semantic_search");
    expect(message).toContain("website");
    expect(message).not.toMatch(/sk-|password|BEGIN PRIVATE|raw_content":/);
    const parsed = JSON.parse(message) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("rawContent");
    expect(parsed).not.toHaveProperty("config");
    expect(parsed).not.toHaveProperty("secrets");
  });

  it("strips poisoned workload fields before prompting", () => {
    const message = buildEstimatorUserMessage({
      question: "hello",
      availableTools: tools,
      workload: {
        ...emptyOrgWorkloadSummary(),
        rawContent: "NEVER SEND THIS PAGE",
        config: { apiKey: "sk-live-secret" },
      } as never,
      conversation: { messageCount: 0, characterCount: 0, queryCharacterCount: 5 },
    });
    expect(message).not.toContain("NEVER SEND THIS PAGE");
    expect(message).not.toContain("sk-live-secret");
  });
});

describe("heuristic and fallback", () => {
  it("short-circuits greetings to Simple without tools", () => {
    const route = buildHeuristicRoute("hello there");
    expect(route?.source).toBe("heuristic");
    expect(route?.complexity).toBe("low");
    expect(route?.workloadClass).toBe("simple");
    expect(route?.billable).toBe(false);
    expect(route?.estimatedCredits).toBe(0);
    expect(route?.likelyTools).toEqual([]);
  });

  it.each(["hi", "hello", "how are you?", "thanks", "goodbye"])(
    "routes social turn %s at zero credits",
    (question) => {
      const route = buildHeuristicRoute(question);
      expect(route?.billable).toBe(false);
      expect(route?.estimatedCredits).toBe(0);
    },
  );

  it("does not heuristic-route a product question without small-corpus context", () => {
    expect(buildHeuristicRoute("What is included in the Starter plan?")).toBeNull();
  });

  it("fast-paths short product questions on a tiny knowledge corpus", () => {
    const route = buildHeuristicRoute("What is included in the free plan?", {
      availableToolNames: ["semantic_search"],
      chunkCount: 6,
    });
    expect(route?.source).toBe("heuristic");
    expect(route?.workloadClass).toBe("simple");
    expect(route?.likelyTools).toEqual(["semantic_search"]);
    expect(route?.estimatedCredits).toBe(1);
  });

  it("keeps a short meaningful company question billable", () => {
    const route = parseCreditClassifierDecision(
      JSON.stringify({
        billable: true,
        workload: "simple",
        reason: "Short pricing question",
      }),
      [],
    );
    expect(route?.billable).toBe(true);
    expect(route?.estimatedCredits).toBe(1);
  });

  it("rejects classifier output without an explicit billability decision", () => {
    expect(
      parseCreditClassifierDecision(
        JSON.stringify({ workload: "simple" }),
        [],
      ),
    ).toBeNull();
  });

  it("falls back conservatively when the classifier fails", () => {
    const route = buildFallbackRoute(["semantic_search", "web_search"]);
    expect(route.source).toBe("fallback");
    expect(route.complexity).toBe("medium");
    expect(route.workloadClass).toBe("standard");
    expect(route.billable).toBe(true);
    expect(route.estimatedCredits).toBe(2);
    expect(route.likelyTools).toEqual(["semantic_search"]);
    expect(route.confidence).toBeLessThan(0.5);
  });

  it("uses the shared workload rubric in the classifier prompt", () => {
    expect(prompts.complexityClassifier).toContain('"billable": true|false');
    expect(prompts.complexityClassifier).toContain(
      '"workload": "simple"|"standard"|"complex"',
    );
    expect(prompts.complexityClassifier).toContain(
      "Simple (runtime budget · 1 credit)",
    );
    expect(prompts.complexityClassifier).toContain(
      "Complex (runtime budget · 8 credits)",
    );
    expect(prompts.complexityClassifier).toContain("application handoff");
  });
});

describe("applyAffordabilityToRoute", () => {
  it("propagates Simple budgets when Complex is remapped", () => {
    const complex = routeFromClass("complex", {
      billable: true,
      source: "classifier",
      likelyTools: ["semantic_search"],
      expectedSearchRounds: 2,
      expectedToolRounds: 2,
      expectedInputTokensBand: "l",
      expectedOutputTokensBand: "m",
      confidence: 0.8,
      reason: "needs deep research",
    });
    const remapped = applyAffordabilityToRoute(complex, {
      requestedClass: "complex",
      effectiveClass: "simple",
      downgradedFrom: "complex",
      billingMode: "included",
      reason: "insufficient_credits",
    });
    expect(remapped.workloadClass).toBe("simple");
    expect(remapped.complexity).toBe("low");
    expect(remapped.estimatedCredits).toBe(1);
    expect(remapped.requestedClass).toBe("complex");
    expect(remapped.downgradedFrom).toBe("complex");
    expect(remapped.billingMode).toBe("included");
    expect(remapped.model).not.toBe(complex.model);
  });

  it("keeps requested Complex model budgets on paid on-demand passthrough", () => {
    const complex = routeFromClass("complex", {
      billable: true,
      source: "classifier",
      likelyTools: ["semantic_search"],
      expectedSearchRounds: 2,
      expectedToolRounds: 2,
      expectedInputTokensBand: "l",
      expectedOutputTokensBand: "m",
      confidence: 0.8,
      reason: "needs deep research",
    });
    const remapped = applyAffordabilityToRoute(complex, {
      requestedClass: "complex",
      effectiveClass: "complex",
      downgradedFrom: null,
      billingMode: "on_demand",
      reason: "on_demand_passthrough",
    });
    expect(remapped.workloadClass).toBe("complex");
    expect(remapped.estimatedCredits).toBe(8);
    expect(remapped.billingMode).toBe("on_demand");
    expect(remapped.model).toBe(complex.model);
  });
});
