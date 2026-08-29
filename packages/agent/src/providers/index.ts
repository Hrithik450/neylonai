import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createZyloAI, createGroq, createGemini, buildFallbackChain, ModelConfig } from "./factory";
import { getAgentModelHigh, getAgentModelMedium, getUtilityModel } from "../lib/models";
import { StructuredToolInterface } from "@langchain/core/tools";

export type ModelTier = "complex" | "standard" | "simple";

export function getProviderModel(tier: ModelTier, config?: ModelConfig, tools?: StructuredToolInterface[]): BaseChatModel {
  let models: BaseChatModel[] = [];

  switch (tier) {
    case "complex":
      // ZyloAI Minimax -> Groq OSS -> Gemini High
      models = [
        ...createZyloAI("minimax-m3", config, tools),
        ...createGroq("llama-3.3-70b-versatile", config, tools),
        ...createGemini(getAgentModelHigh(), config, tools),
      ];
      break;
      
    case "standard":
      // ZyloAI Minimax -> ZyloAI OSS -> Groq OSS -> Gemini Medium
      models = [
        ...createZyloAI("minimax-m3", config, tools),
        ...createZyloAI("gpt-oss", config, tools),
        ...createGroq("llama-3.3-70b-versatile", config, tools),
        ...createGemini(getAgentModelMedium(), config, tools),
      ];
      break;

    case "simple":
      // ZyloAI OSS -> Groq OSS -> Gemini Utility
      models = [
        ...createZyloAI("gpt-oss", config, tools),
        ...createGroq("llama-3.3-70b-versatile", config, tools),
        ...createGemini(getUtilityModel(), config, tools),
      ];
      break;
  }

  return buildFallbackChain(models);
}
