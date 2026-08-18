/**
 * LLM helpers for website import.
 * Discovery classifies URL metadata only — never page bodies.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  isGoogleRateLimitError,
  withGoogleApiRetry,
} from "../internal/gemini";
import type { ClassifiedUrl, EvergreenCategory } from "./evergreen";

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return content == null ? "" : String(content);
}

const DEFAULT_UTILITY_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_UTILITY_OUTPUT_TOKENS = 32_000;

function utilityModel(): string {
  return process.env.UTILITY_MODEL?.trim() || DEFAULT_UTILITY_MODEL;
}

function utilityOutputTokenBudget(): number {
  const configured = Number(process.env.UTILITY_MODEL_OUTPUT_TOKENS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_UTILITY_OUTPUT_TOKENS;
}

async function invokeUtility(prompt: string): Promise<string> {
  const model = utilityModel();
  return withGoogleApiRetry(async (apiKey) => {
    const llm = new ChatGoogleGenerativeAI({
      model,
      temperature: 0.1,
      maxOutputTokens: utilityOutputTokenBudget(),
      maxRetries: 0,
      apiKey,
    });
    const response = await llm.invoke(prompt);
    return messageText(response.content).trim();
  });
}

const LLM_BATCH = 80;

/**
 * Rerank heuristic-classified URLs using path/sitemap metadata only.
 * Falls back to the input order on any model failure.
 */
export async function llmRerankEvergreenUrls(
  seedUrl: string,
  candidates: ClassifiedUrl[],
  maxPages: number,
): Promise<ClassifiedUrl[]> {
  const eligible = candidates.filter((c) => !c.excluded);
  if (eligible.length === 0) return [];
  const batch = eligible.slice(0, Math.max(LLM_BATCH, maxPages * 4));

  const prompt = `You select evergreen pages for a company support chatbot knowledge base.

Seed URL: ${seedUrl}

INCLUDE: home, product/platform, features, pricing/plans, about, team, contact, FAQ, help/docs, policies, careers overview, evergreen blog posts, case studies.
EXCLUDE: search, account, login, cart, checkout, SKU/catalog detail, faceted/filter URLs, dated news, archives, tags, pagination, duplicates.

Candidate URLs (path, category, lastmod):
${batch
  .map(
    (c, i) =>
      `${i + 1}. ${c.url} | ${c.category} | lastmod=${c.lastmod ?? "unknown"}`,
  )
  .join("\n")}

Reply with ONLY a JSON array of up to ${maxPages} URL strings, best first.`;

  try {
    const raw = await invokeUtility(prompt);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return eligible.slice(0, maxPages);
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return eligible.slice(0, maxPages);
    const wanted = parsed.filter(
      (u): u is string => typeof u === "string" && u.startsWith("http"),
    );
    const byUrl = new Map(eligible.map((c) => [c.url, c]));
    const picked: ClassifiedUrl[] = [];
    for (const url of wanted) {
      const row = byUrl.get(url);
      if (row && !picked.some((p) => p.url === row.url)) picked.push(row);
      if (picked.length >= maxPages) break;
    }
    if (picked.length === 0) return eligible.slice(0, maxPages);
    for (const row of eligible) {
      if (picked.length >= maxPages) break;
      if (!picked.some((p) => p.url === row.url)) picked.push(row);
    }
    return picked;
  } catch {
    return eligible.slice(0, maxPages);
  }
}

export type { EvergreenCategory };
