/**
 * Gemini model IDs — single source of truth in `@neylonai/agent`.
 * Edit here (and `.env`) when Google retires a model.
 */

export const MODEL_DEFAULTS = {
  low: "gemini-3.1-flash-lite",
  medium: "gemini-3.5-flash-lite",
  high: "gemini-3.6-flash",
  classifier: "gemini-3.1-flash-lite",
  tips: "gemini-3.1-flash-lite",
  utility: "gemini-3.1-flash-lite",
  /** Widget mic → text (Gemini audio understanding). */
  stt: "gemini-3.1-flash-lite",
  embedding: "gemini-embedding-001",
} as const;

const DEPRECATED_MODEL_IDS: Record<string, string> = {
  "gemini-2.5-flash-lite": MODEL_DEFAULTS.low,
  "gemini-2.5-flash-lite-preview-09-2025": MODEL_DEFAULTS.low,
  "gemini-2.0-flash-lite": MODEL_DEFAULTS.low,
  "gemini-2.0-flash": MODEL_DEFAULTS.medium,
  "gemini-2.5-flash": MODEL_DEFAULTS.medium,
};

function env(name: string): string | undefined {
  const value = process.env[name];
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveModelId(modelId: string): string {
  const mapped = DEPRECATED_MODEL_IDS[modelId] ?? modelId;
  if (mapped !== modelId) {
    console.warn(`[models] remapped retired model "${modelId}" → "${mapped}"`);
  }
  return mapped;
}

export function getClassifierModel(): string {
  return resolveModelId(env("ROUTER_CLASSIFIER_MODEL") ?? MODEL_DEFAULTS.classifier);
}

export function getAgentModelLow(): string {
  return resolveModelId(env("AGENT_MODEL_LOW") ?? MODEL_DEFAULTS.low);
}

export function getAgentModelMedium(): string {
  return resolveModelId(env("AGENT_MODEL_MEDIUM") ?? MODEL_DEFAULTS.medium);
}

export function getAgentModelHigh(): string {
  return resolveModelId(
    env("AGENT_MODEL_HIGH") ?? env("AGENT_MODEL") ?? MODEL_DEFAULTS.high,
  );
}

export function getTipsModel(): string {
  return resolveModelId(
    env("THINKING_TIPS_MODEL") ?? env("ROUTER_CLASSIFIER_MODEL") ?? MODEL_DEFAULTS.tips,
  );
}

export function getUtilityModel(): string {
  return resolveModelId(env("UTILITY_MODEL") ?? MODEL_DEFAULTS.utility);
}

export function getEmbeddingModel(): string {
  return resolveModelId(env("EMBEDDING_MODEL") ?? MODEL_DEFAULTS.embedding);
}

export function getSttModel(): string {
  return resolveModelId(
    env("STT_MODEL") ?? env("UTILITY_MODEL") ?? MODEL_DEFAULTS.stt,
  );
}
