import { cacheGet, cacheSet, type KnowledgeSuggestionSeed } from "@neylonai/database";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createHash } from "crypto";
import { getProviderModel } from "../../../providers";
import { prompts } from "../../../lib/prompts";
import { getUtilityModel } from "../../../lib/models";
import { meterModelResponse } from "../../../infrastructure/metering";
import { bubbleDedupeKey, cleanQuestion, normalizeExcerpt } from "./text";

/**
 * Model-written bubble candidates.
 *
 * The pool is generated from the org's own knowledge base, cached per
 * organization + page (never per visitor), and then ranked per visitor by the
 * caller. That keeps quality high at roughly one cheap utility-model call per
 * page per cache window, instead of one call per bubble.
 */

/** Bump when the prompt or shaping rules change, to invalidate warm caches. */
const CANDIDATE_PROMPT_VERSION = "v3";
const CANDIDATE_CACHE_TTL_SEC = 6 * 60 * 60;
const TARGET_CANDIDATES = 10;
const MAX_SEEDS_IN_PROMPT = 12;
const SEED_EXCERPT_CHARS = 220;
/** Page text budget in the prompt — enough for topics, small enough to stay cheap. */
const PAGE_TEXT_CHARS = 2_000;

export interface GenerateProactiveCandidatesInput {
  organizationId: string;
  pagePath: string;
  pageUrl?: string | null;
  /** Knowledge-base samples for this org. */
  seeds: KnowledgeSuggestionSeed[];
  /** Crawled text of this exact page — the page-specific grounding. */
  pageText: string;
  /**
   * This visitor's recent questions, oldest→newest. When present, the pool is
   * generated to anticipate their NEXT question (and cached per conversation
   * state, since the brief — and therefore the cache key — now varies by it);
   * absent, generation stays org+page-shared and cheap.
   */
  recentUserAsks?: string[];
}

function candidatesCacheKey(input: {
  organizationId: string;
  pagePath: string;
  brief: string;
}): string {
  const digest = createHash("sha256")
    .update(`${input.organizationId}|${input.pagePath}|${input.brief}`)
    .digest("hex")
    .slice(0, 32);
  return `proactive-candidates:${CANDIDATE_PROMPT_VERSION}:${digest}`;
}

/** Compact, secret-free brief describing what this org's site is about. */
function buildBrief(input: GenerateProactiveCandidatesInput): string {
  const lines: string[] = [`Page path: ${input.pagePath}`];
  if (input.pageUrl) {
    try {
      lines.push(`Site: ${new URL(input.pageUrl).hostname}`);
    } catch {
      // Ignore unparseable page URLs.
    }
  }

  const seedLines = input.seeds
    .slice(0, MAX_SEEDS_IN_PROMPT)
    .map((seed) => {
      const title = seed.title?.trim();
      const excerpt = normalizeExcerpt(seed.excerpt).slice(
        0,
        SEED_EXCERPT_CHARS,
      );
      if (!title && !excerpt) return null;
      return `- ${title ? `${title}: ` : ""}${excerpt}`;
    })
    .filter((line): line is string => Boolean(line));

  if (seedLines.length) {
    lines.push("", "What this company publishes:", ...seedLines);
  }

  const pageText = normalizeExcerpt(input.pageText).slice(0, PAGE_TEXT_CHARS);
  if (pageText) {
    lines.push(
      "",
      "What this exact page says (ground the questions in this):",
      pageText,
    );
  }

  const asks = (input.recentUserAsks ?? [])
    .map((ask) => normalizeExcerpt(ask).slice(0, 160))
    .filter(Boolean)
    .slice(-3);
  if (asks.length) {
    lines.push(
      "",
      "What this visitor has already asked (anticipate their NEXT question — build on these, never repeat them):",
      ...asks.map((ask) => `- ${ask}`),
    );
  }

  return lines.join("\n");
}

function parseSuggestions(raw: string): string[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { suggestions?: unknown };
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

/** Cleans, de-duplicates and caps raw model output. */
export function shapeCandidates(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const cleaned = cleanQuestion(value);
    if (!cleaned) continue;
    const key = bubbleDedupeKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= TARGET_CANDIDATES) break;
  }
  return out;
}

/**
 * Generates a pool of catchy, knowledge-grounded bubble questions.
 * Returns `[]` on any failure so callers fall back to deterministic candidates.
 */
export async function generateProactiveCandidates(
  input: GenerateProactiveCandidatesInput,
): Promise<string[]> {
  const brief = buildBrief(input);
  if (
    !input.seeds.length &&
    !input.pageText.trim() &&
    !(input.recentUserAsks ?? []).some((ask) => ask.trim())
  )
    return [];

  const cacheKey = candidatesCacheKey({
    organizationId: input.organizationId,
    pagePath: input.pagePath,
    brief,
  });

  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      // Fall through and regenerate.
    }
  }

  try {
    const utilityModel = getUtilityModel();
    const llm = getProviderModel("simple", {
      temperature: 0.9,
      maxTokens: 700,
      jsonMode: true,
    });
    
    const response = await llm.invoke([
      new SystemMessage(prompts.proactiveBubbleSeeds),
      new HumanMessage(brief.slice(0, 6_000)),
    ]);
    meterModelResponse(utilityModel, response, {
      metadata: { purpose: "proactive_candidates", pagePath: input.pagePath },
    });

    const raw =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    const shaped = shapeCandidates(parseSuggestions(raw));
    if (shaped.length >= 4) {
      await cacheSet(
        cacheKey,
        JSON.stringify(shaped),
        CANDIDATE_CACHE_TTL_SEC,
      );
    }
    return shaped;
  } catch (error) {
    console.warn(
      "[proactive-suggestions] candidate generation skipped:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
