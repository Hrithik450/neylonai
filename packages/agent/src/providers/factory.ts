import { getApiKeys } from "./keys";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StructuredToolInterface } from "@langchain/core/tools";

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

function bindToolsIfAny(model: BaseChatModel, tools?: StructuredToolInterface[]): BaseChatModel {
  if (tools && tools.length > 0 && typeof (model as any).bindTools === "function") {
    return (model as any).bindTools(tools);
  }
  return model;
}

// 1. ZyloAI (Minimax & OSS)
export function createZyloAI(modelName: "minimax-m3" | "gpt-oss", config?: ModelConfig, tools?: StructuredToolInterface[]): BaseChatModel[] {
  const keys = getApiKeys("ZYLONAI_API_KEYS");
  console.log(`[factory] createZyloAI keys for ${modelName}:`, keys);
  return keys.map((key) => {
    const m = new ChatOpenAI({
      modelName,
      apiKey: key,
      configuration: {
        baseURL: "https://api.zyloai.net/v1",
      },
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens,
      maxRetries: 1, // Fallbacks handle retries
      modelKwargs: config?.jsonMode ? { response_format: { type: "json_object" } } : {},
    });
    return bindToolsIfAny(m, tools);
  });
}

// 2. Groq (OSS)
export function createGroq(modelName: string = "llama-3.3-70b-versatile", config?: ModelConfig, tools?: StructuredToolInterface[]): BaseChatModel[] {
  const keys = getApiKeys("GROQ_API_KEYS");
  return keys.map((key) => {
    const m = new ChatOpenAI({
      modelName,
      apiKey: key,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1",
      },
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens,
      maxRetries: 1,
      modelKwargs: config?.jsonMode ? { response_format: { type: "json_object" } } : {},
    });
    return bindToolsIfAny(m, tools);
  });
}

// 3. Gemini
export function createGemini(modelName: string, config?: ModelConfig, tools?: StructuredToolInterface[]): BaseChatModel[] {
  const keys = getApiKeys("GEMINI_API_KEYS");
  if (keys.length === 0) {
    // Fallback to single GOOGLE_API_KEY if multiple aren't provided
    const singleKey = process.env.GOOGLE_API_KEY;
    if (singleKey) keys.push(singleKey);
  }
  
  return keys.map((key) => {
    // @ts-ignore - Some versions of ChatGoogleGenerativeAI use json, others don't, but we'll pass it safely
    const m = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: key,
      temperature: config?.temperature ?? 0.7,
      maxOutputTokens: config?.maxTokens,
      maxRetries: 1,
      ...(config?.jsonMode ? { response_format: { type: "json_object" } } : {}) // standard for newer google-genai
    });
    // Older versions of google-genai used 'json: true'. We handle both just in case:
    if (config?.jsonMode) {
      (m as any).json = true;
    }
    return bindToolsIfAny(m, tools);
  });
}

/**
 * Helper to chain an array of models into a single fallback runnable.
 */
export function buildFallbackChain(models: BaseChatModel[]): BaseChatModel {
  if (models.length === 0) {
    throw new Error("No models available for fallback chain. Check your API keys.");
  }
  if (models.length === 1) {
    return models[0];
  }
  
  const [primary, ...fallbacks] = models;
  return primary.withFallbacks({ fallbacks }) as unknown as BaseChatModel;
}
