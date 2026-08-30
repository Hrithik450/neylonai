import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createGroq, createGemini, buildFallbackChain, ModelConfig } from "./factory";
import { getAgentModelHigh, getAgentModelMedium, getUtilityModel } from "../lib/models";
import { StructuredToolInterface } from "@langchain/core/tools";

export type ModelTier = "complex" | "standard" | "simple";

export function getProviderModel(tier: ModelTier, config?: ModelConfig, tools?: StructuredToolInterface[]): BaseChatModel {
  let models: BaseChatModel[] = [];

  switch (tier) {
    case "complex":
      // Groq (GPT OSS 120B) -> Gemini High
      models = [
        ...createGroq("openai/gpt-oss-120b", config, tools),
        ...createGemini(getAgentModelHigh(), config, tools),
      ];
      break;
      
    case "standard":
      // Groq (GPT OSS 120B) -> Gemini Medium
      models = [
        ...createGroq("openai/gpt-oss-120b", config, tools),
        ...createGemini(getAgentModelMedium(), config, tools),
      ];
      break;

    case "simple":
      // Groq (GPT OSS 120B) -> Gemini Utility
      models = [
        ...createGroq("openai/gpt-oss-120b", config, tools),
        ...createGemini(getUtilityModel(), config, tools),
      ];
      break;
  }

  return buildFallbackChain(models);
}
