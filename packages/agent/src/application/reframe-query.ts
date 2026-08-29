import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getProviderModel } from "../providers";
import type { ConversationMessage } from "../domain/types";
import { prompts } from "../lib/prompts";
import { getUtilityModel } from "../lib/models";
import { getTodayDate } from "../lib/date";
import { meterModelResponse } from "../infrastructure/metering";

export interface ReframedQuery {
  is_followup: boolean;
  optimized_query: string;
}

function extractJson(raw: string): ReframedQuery | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as ReframedQuery;
  } catch {
    return null;
  }
}

export async function reframeQuery(
  userInput: string,
  conversationHistory: ConversationMessage[],
): Promise<ReframedQuery> {
  const fallback: ReframedQuery = {
    is_followup: false,
    optimized_query: userInput,
  };

  if (!conversationHistory || conversationHistory.length === 0) return fallback;

  try {
    const contextLines = conversationHistory
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const userPrompt = `Conversation context (last ${Math.min(conversationHistory.length, 10)} messages):
${contextLines}

New user question:
${userInput}`;

    const systemContent = prompts.queryReframe.replace(
      "{today_date}",
      getTodayDate(),
    );

    const utilityModel = getUtilityModel();
    const llm = getProviderModel("simple", { temperature: 0.2 });
    const response = await llm.invoke([
      new SystemMessage(systemContent),
      new HumanMessage(userPrompt),
    ]);
    meterModelResponse(utilityModel, response);

    const content =
      typeof response.content === "string" ? response.content : "";
    const parsed = extractJson(content);
    return parsed ?? fallback;
  } catch (error) {
    console.error("query reframe failed:", error);
    return fallback;
  }
}
