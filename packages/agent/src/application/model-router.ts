import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";
import { meterModelResponse } from "../infrastructure/metering";
import { prompts } from "../lib/prompts";
import {
  getAgentModelHigh,
  getAgentModelLow,
  getAgentModelMedium,
  getClassifierModel,
} from "../lib/models";

export type ComplexityTier = "low" | "medium" | "high";

export interface ModelRoute {
  complexity: ComplexityTier;
  model: string;
  /** How the route was chosen. */
  source: "heuristic" | "classifier";
}

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
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|bye|good morning|good evening)\b/i.test(
      lower,
    ) &&
    words <= 8
  ) {
    return "low";
  }

  if (
    words <= 6 &&
    /^(what is|who is|when is|where is|book a demo|schedule|pricing)\b/i.test(
      lower,
    )
  ) {
    return "low";
  }

  const highSignals =
    /\b(architect|architecture|design system|multi-?agent|orchestrat|debug|implement|refactor|step by step|trade-?offs?|compare and contrast|end-to-end|production-ready|latency|scalability)\b/i.test(
      q,
    ) ||
    words >= 40 ||
    (q.match(/\?/g)?.length ?? 0) >= 3;

  if (highSignals) return "high";

  if (words >= 18 || /^(how|why|explain|compare|difference)\b/i.test(lower)) {
    return "medium";
  }

  return null;
}

function parseComplexity(raw: string): ComplexityTier | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { complexity?: string };
    const c = parsed.complexity?.toLowerCase();
    if (c === "low" || c === "medium" || c === "high") return c;
    return null;
  } catch {
    return null;
  }
}

/**
 * Route a user question to a Gemini model tier.
 * Heuristics first (0 LLM latency); otherwise a tiny Flash-Lite JSON classify.
 */
export async function routeModel(question: string): Promise<ModelRoute> {
  const heuristic = classifyComplexityHeuristic(question);
  if (heuristic) {
    return {
      complexity: heuristic,
      model: getModelForComplexity(heuristic),
      source: "heuristic",
    };
  }

  try {
    const classifierModel = getClassifierModelId();
    const response = await withGoogleApiRetry(async (apiKey) => {
      const llm = new ChatGoogleGenerativeAI({
        model: classifierModel,
        temperature: 0,
        maxRetries: 0,
        json: true,
        apiKey,
      });
      return llm.invoke([
        new SystemMessage(prompts.complexityClassifier),
        new HumanMessage(question.slice(0, 500)),
      ]);
    });
    meterModelResponse(classifierModel, response);
    const raw =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    const complexity = parseComplexity(raw) ?? "medium";
    return {
      complexity,
      model: getModelForComplexity(complexity),
      source: "classifier",
    };
  } catch (error) {
    console.warn(
      "[model-router] classifier failed, falling back to medium:",
      error instanceof Error ? error.message : error,
    );
    return {
      complexity: "medium",
      model: getModelForComplexity("medium"),
      source: "classifier",
    };
  }
}
