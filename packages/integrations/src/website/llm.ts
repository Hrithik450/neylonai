/**
 * LLM helpers for website import.
 * Scrape full page content first; LLM only strips DB-backed catalog noise.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { withGoogleApiRetry } from "../internal/gemini";

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

async function invokeUtility(prompt: string): Promise<string> {
  const model =
    process.env.UTILITY_MODEL?.trim() || "gemini-2.0-flash-lite";
  return withGoogleApiRetry(async (apiKey) => {
    const llm = new ChatGoogleGenerativeAI({
      model,
      temperature: 0.1,
      maxRetries: 0,
      apiKey,
    });
    const response = await llm.invoke(prompt);
    return messageText(response.content).trim();
  });
}

/**
 * From candidate URLs, keep company pages; drop obvious product catalogs.
 */
export async function llmSelectEvergreenUrls(
  seedUrl: string,
  candidates: string[],
  maxPages: number,
): Promise<string[]> {
  const list = candidates.slice(0, 60);
  if (list.length === 0) return [seedUrl];

  const prompt = `You help build a company knowledge base from a public website.

Seed URL: ${seedUrl}

Candidate URLs:
${list.map((u, i) => `${i + 1}. ${u}`).join("\n")}

Select up to ${maxPages} URLs with company information for a support chatbot:
- homepage / landing, about, team, mission, contact, careers overview
- pricing (static plans), features, docs, FAQ, help, blog posts about the company
- legal/policies (privacy, terms, shipping policy overview)

ALWAYS include the seed URL when it is the homepage or has company overview copy.

EXCLUDE only when clearly product listing / SKU / cart / checkout / search / account pages.

Reply with ONLY a JSON array of URL strings, no markdown.
If unsure, prefer including the seed URL and about/docs/pricing/FAQ pages.`;

  try {
    const raw = await invokeUtility(prompt);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [seedUrl, ...list.slice(0, Math.max(0, maxPages - 1))];
    }
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [seedUrl];
    const urls = parsed
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      .slice(0, maxPages);
    return urls.length > 0 ? urls : [seedUrl];
  } catch {
    return [seedUrl, ...list.slice(0, Math.max(0, maxPages - 1))];
  }
}

/**
 * Strip database-backed catalog / inventory sections only.
 * Must preserve nearly all scraped page content — do not summarize.
 */
export async function llmStripDatabaseBackedContent(input: {
  url: string;
  title: string;
  text: string;
}): Promise<string> {
  const clipped = input.text.slice(0, 100_000).trim();
  if (!clipped) return "";

  const prompt = `You clean website text for a company knowledge base.

CRITICAL RULES:
1. DO NOT summarize, rewrite, or shorten the page.
2. KEEP almost all content: hero copy, features, FAQs, pricing plans, about, CTAs, policies, contact.
3. DELETE only sections that are clearly database-backed product catalogs: long SKU/item grids, per-product inventory lists, searchable product feeds.
4. You may lightly drop pure nav chrome / cookie-banner boilerplate if obvious.
5. Return the cleaned markdown. If nothing needs removing, return the original text unchanged.

Page title: ${input.title}
URL: ${input.url}

Scraped page text:
${clipped}`;

  try {
    const out = await invokeUtility(prompt);
    if (!out || out.length < Math.min(200, clipped.length * 0.2)) {
      // Model over-trimmed — keep the full scrape.
      return clipped;
    }
    return out.slice(0, 180_000);
  } catch {
    return clipped;
  }
}

/** @deprecated Use llmStripDatabaseBackedContent */
export async function llmDistillPageContent(input: {
  url: string;
  title: string;
  text: string;
}): Promise<string> {
  return llmStripDatabaseBackedContent(input);
}
