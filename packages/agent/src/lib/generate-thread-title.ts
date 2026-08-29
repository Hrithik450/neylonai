import { getProviderModel } from "../providers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getUtilityModel } from "./models";
import { prompts } from "./prompts";
import { meterModelResponse } from "../infrastructure/metering";

const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", prompts.threadTitle],
  ["human", "{userMessage}"],
]);

export async function generateThreadTitle(userInput: string): Promise<string> {
  try {
    const utilityModel = getUtilityModel();
    const llm = getProviderModel("simple", {
      temperature: 0.4,
      jsonMode: true,
    });
    
    const response = await promptTemplate.pipe(llm).invoke({ userMessage: userInput });
    meterModelResponse(utilityModel, response);
    const content =
      typeof response.content === "string" ? response.content : "";
    const parsed = JSON.parse(content);
    return parsed.title ?? "New Chat";
  } catch {
    return "New Chat";
  }
}
