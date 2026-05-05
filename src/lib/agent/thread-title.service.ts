import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const titlePrompt = `You are an AI that creates short, descriptive titles for new chat conversations based on the user's first message.

Instructions:
1. Read the message and understand the intent.
2. Generate a clear, concise title (2 to 5 words).

Output Format:
Respond with a JSON object only:
{{"title": "Your Title Output"}}

Guidelines:
- Be brief: 2–5 words max.
- Be relevant: Reflect the message.
- Be clear: Easily understandable.
- No conversation, questions, or extra text.
- No punctuation at the end.
- Use Title Case.
- No emojis or special characters.`;

const llm = new ChatOpenAI({
  model: "gpt-4.1-nano",
  temperature: 0.4,
  modelKwargs: { response_format: { type: "json_object" } },
  apiKey: process.env.OPENAI_API_KEY,
});

const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", titlePrompt],
  ["human", "{userMessage}"],
]);

export async function generateThreadTitle(userInput: string): Promise<string> {
  try {
    const chain = promptTemplate.pipe(llm);
    const response = await chain.invoke({ userMessage: userInput });
    const content = typeof response.content === "string" ? response.content : "";
    const parsed = JSON.parse(content);
    return parsed.title ?? "New Chat";
  } catch {
    return "New Chat";
  }
}
