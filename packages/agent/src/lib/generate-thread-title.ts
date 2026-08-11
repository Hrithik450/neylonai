import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";
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
    const response = await withGoogleApiRetry(async (apiKey) => {
      const llm = new ChatGoogleGenerativeAI({
        model: utilityModel,
        temperature: 0.4,
        maxRetries: 0,
        json: true,
        apiKey,
      });
      return promptTemplate.pipe(llm).invoke({ userMessage: userInput });
    });
    meterModelResponse(utilityModel, response);
    const content =
      typeof response.content === "string" ? response.content : "";
    const parsed = JSON.parse(content);
    return parsed.title ?? "New Chat";
  } catch {
    return "New Chat";
  }
}
