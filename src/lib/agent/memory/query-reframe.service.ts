import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const MEMORY_LAYER_PROMPT = `You are an expert routing agent.
- Today's date is {today_date} IST.

Task:
Given the previous conversation and a new user question,
1. Decide if it is a FOLLOW-UP (depends on prior context) or NEW.
2. Produce a concise, self-contained query (≤200 chars).
3. Output only valid JSON.

Output format:
{
  "is_followup": true | false,
  "optimized_query": "<rewritten or original question>"
}

Guidelines (apply in order):
0. CONVERSATIONAL CHECK: If the query is a casual greeting or general factual query (e.g. "how are you", "what time is it"), return is_followup: false and keep the original query.
1. CORE TEST: Classify as FOLLOW-UP only if the new question cannot be correctly answered or understood WITHOUT the previous messages, OR the user explicitly references the earlier conversation.
2. PRONOUN CHECK: If the new question uses ambiguous pronouns ("it", "that", "those") and the referent is only introduced in prior messages, treat as FOLLOW-UP.
3. WHEN FOLLOW-UP: Rewrite the user question as a concise, self-contained single-sentence query. Keep optimized_query ≤ 200 characters.
4. WHEN NEW: Return the original question as optimized_query (clean up phrasing only).
5. Output ONLY the JSON object and nothing else.`;

export interface ReframedQuery {
  is_followup: boolean;
  optimized_query: string;
}

let memoryLlm: ChatGoogleGenerativeAI | null = null;

function getMemoryLlm(): ChatGoogleGenerativeAI {
  if (!memoryLlm) {
    memoryLlm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.2,
      maxRetries: 2,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  return memoryLlm;
}

function getTodayDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<ReframedQuery> {
  const fallback: ReframedQuery = { is_followup: false, optimized_query: userInput };

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

    const systemContent = MEMORY_LAYER_PROMPT.replace(
      "{today_date}",
      getTodayDate(),
    );

    const llm = getMemoryLlm();
    const response = await llm.invoke([
      new SystemMessage(systemContent),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === "string" ? response.content : "";
    const parsed = extractJson(content);
    return parsed ?? fallback;
  } catch (error) {
    console.error("query reframe failed:", error);
    return fallback;
  }
}
