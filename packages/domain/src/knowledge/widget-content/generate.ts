/**
 * Widget content generator: turn crawled site knowledge into a grounded base of
 * widget copy — greeting, intro lines, suggested questions, ask/feedback
 * labels, and FAQs. This is a pure LLM + validation step; the caller owns
 * persistence and the one-way `contentInitialized` lock.
 *
 * The generated copy auto-publishes LIVE to the client's visitors with no human
 * review, so the anti-fabrication guardrail (prompt + validation) is a
 * correctness requirement, not a nicety: never invent pricing, guarantees,
 * metrics, integrations, or customer names. When the site doesn't support a
 * claim, we omit the field and the caller falls back to a neutral static
 * default.
 *
 * Structurally mirrors the proactive-suggestion candidate generator
 * (packages/agent/.../proactive-suggestions/generate-candidates.ts), but lives
 * here because @neylonai/agent depends on @neylonai/domain, not the reverse —
 * so the agent's model resolver / prompts / metering are unreachable and are
 * re-created locally.
 */

import {
  listKnowledgeSuggestionSeeds,
  type KnowledgeSuggestionSeed,
} from "@neylonai/database";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { withGoogleApiRetry } from "@neylonai/integrations";
import { extractTokenUsage, recordModelUsageSafe } from "../../billing";

/** Partial, validated widget copy. Every field is optional — omitted fields
 * fall back to the static widget defaults at merge time. */
export interface WidgetContentDraft {
  welcomeGreeting?: string;
  introMessages?: string[];
  suggestedQuestions?: string[];
  askTitle?: string;
  askSubtitle?: string;
  feedbackTitle?: string;
  feedbackSubtitle?: string;
  faqs?: Array<{ question: string; answer: string }>;
}

const MAX_SEEDS_IN_PROMPT = 14;
const SEED_EXCERPT_CHARS = 240;
const PROMPT_CHAR_BUDGET = 6_000;

// Field caps mirror how the widget renders each string (see
// DEFAULT_WIDGET_MESSAGES in @neylonai/sdk) so generated copy never overflows.
const MAX_INTRO = 3;
const MAX_SUGGESTED = 4;
const MAX_FAQS = 4;
const LIMIT_GREETING = 120;
const LIMIT_INTRO = 140;
const LIMIT_QUESTION = 120;
const LIMIT_ASK_TITLE = 60;
const LIMIT_ASK_SUBTITLE = 120;
const LIMIT_FEEDBACK_TITLE = 60;
const LIMIT_FEEDBACK_SUBTITLE = 140;
const LIMIT_FAQ_ANSWER = 360;

/** Small local resolver — the agent's `getUtilityModel` is in a package we
 * can't import from domain. Optional env override, cheap flash-lite default. */
function utilityModel(): string {
  return process.env.UTILITY_MODEL?.trim() || "gemini-3.1-flash-lite";
}

/**
 * The whole defense against fabricated copy lives here + in validation, because
 * output goes live unreviewed. Keep the rules explicit and the JSON shape exact.
 */
const WIDGET_CONTENT_SYSTEM_PROMPT = `You write the visible copy for a website's AI support widget — the small chat panel embedded on a company's own site. Your copy greets visitors, invites questions, and previews what the assistant can answer. It goes LIVE to real visitors immediately, with no human review.

You are given excerpts from the company's own public website. Write the widget copy grounded ONLY in those excerpts.

Absolute rules:
- NEVER invent facts. Do not state or imply pricing, plans, discounts, numbers, percentages, guarantees, SLAs, response times, metrics, awards, certifications, integrations, locations, customer or brand names, testimonials, or any feature or claim that is not clearly present in the provided excerpts.
- If the excerpts do not support a specific claim, stay general. Prefer neutral phrasing about getting answers and help over any concrete promise.
- Do not name the company unless that exact name appears in the excerpts. Address the visitor in the second person ("you"); refer to the company as "we"/"our" — never guess its name.
- Questions must be ones a real visitor could ask and the assistant could plausibly answer from this site's content. No hypothetical features.
- Keep every string short, natural, plain text — no markdown, no emojis, no hashtags, no surrounding quotes.

Ground the copy in the topics, products, and services actually described in the excerpts.

Return STRICT JSON (no prose, no markdown fences) with exactly this shape:
{
  "welcomeGreeting": "short greeting; you MAY include the literal token {name}, which is replaced with the visitor's first name",
  "introMessages": ["1 to 3 short lines shown under the greeting"],
  "suggestedQuestions": ["3 to 4 short questions a visitor might ask, grounded in the site"],
  "askTitle": "very short label for the 'ask a question' action",
  "askSubtitle": "short phrase describing where the answers come from",
  "feedbackTitle": "very short label for the 'talk to a human' card",
  "feedbackSubtitle": "short phrase for the 'talk to a human' card",
  "faqs": [{ "question": "short question", "answer": "1 to 3 sentence answer grounded in the excerpts" }]
}

Provide up to 4 faqs. Omit any field you cannot ground well rather than inventing content.`;

const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Trim + collapse whitespace + hard-cap; null when empty after cleaning. */
function cappedString(value: unknown, cap: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = normalize(value).slice(0, cap).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Case-insensitive de-dupe, preserving first-seen order. */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Compact, secret-free brief describing what this org's site is about. */
function buildBrief(seeds: KnowledgeSuggestionSeed[]): string {
  const seedLines = seeds
    .slice(0, MAX_SEEDS_IN_PROMPT)
    .map((seed) => {
      const title = seed.title?.trim();
      const excerpt = normalize(seed.excerpt).slice(0, SEED_EXCERPT_CHARS);
      if (!title && !excerpt) return null;
      return `- ${title ? `${title}: ` : ""}${excerpt}`;
    })
    .filter((line): line is string => Boolean(line));

  if (!seedLines.length) return "";
  return ["What this company publishes on its website:", ...seedLines].join(
    "\n",
  );
}

/** Extract the first JSON object from raw model text. Never throws. */
export function parseWidgetContentJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Clamp/normalize a raw parsed object into a safe partial draft. Returns null
 * when nothing usable survives, so the caller leaves the static defaults in
 * place (and unlocked). Pure — exported for unit tests.
 */
export function validateWidgetContent(
  parsed: unknown,
): WidgetContentDraft | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const draft: WidgetContentDraft = {};

  const greeting = cappedString(p.welcomeGreeting, LIMIT_GREETING);
  if (greeting) draft.welcomeGreeting = greeting;

  if (Array.isArray(p.introMessages)) {
    const intros = p.introMessages
      .map((v) => cappedString(v, LIMIT_INTRO))
      .filter((v): v is string => Boolean(v))
      .slice(0, MAX_INTRO);
    if (intros.length) draft.introMessages = intros;
  }

  if (Array.isArray(p.suggestedQuestions)) {
    const questions = dedupe(
      p.suggestedQuestions
        .map((v) => cappedString(v, LIMIT_QUESTION))
        .filter((v): v is string => Boolean(v)),
    ).slice(0, MAX_SUGGESTED);
    if (questions.length) draft.suggestedQuestions = questions;
  }

  const askTitle = cappedString(p.askTitle, LIMIT_ASK_TITLE);
  if (askTitle) draft.askTitle = askTitle;
  const askSubtitle = cappedString(p.askSubtitle, LIMIT_ASK_SUBTITLE);
  if (askSubtitle) draft.askSubtitle = askSubtitle;
  const feedbackTitle = cappedString(p.feedbackTitle, LIMIT_FEEDBACK_TITLE);
  if (feedbackTitle) draft.feedbackTitle = feedbackTitle;
  const feedbackSubtitle = cappedString(
    p.feedbackSubtitle,
    LIMIT_FEEDBACK_SUBTITLE,
  );
  if (feedbackSubtitle) draft.feedbackSubtitle = feedbackSubtitle;

  if (Array.isArray(p.faqs)) {
    const faqs = p.faqs
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const e = entry as Record<string, unknown>;
        const question = cappedString(e.question, LIMIT_QUESTION);
        const answer = cappedString(e.answer, LIMIT_FAQ_ANSWER);
        return question && answer ? { question, answer } : null;
      })
      .filter((f): f is { question: string; answer: string } => Boolean(f))
      .slice(0, MAX_FAQS);
    if (faqs.length) draft.faqs = faqs;
  }

  return Object.keys(draft).length ? draft : null;
}

/**
 * Generate a grounded widget content base for an org from its crawled
 * knowledge. Returns null when there's no usable knowledge or the model output
 * is unusable, so callers can leave the static defaults in place (and unlocked
 * for a future retry). Never throws.
 */
export async function generateWidgetContent(
  organizationId: string,
): Promise<WidgetContentDraft | null> {
  const seeds = await listKnowledgeSuggestionSeeds({
    organizationId,
    limit: 24,
    useCache: false,
  });
  if (!seeds.length) return null;

  const brief = buildBrief(seeds);
  if (!brief.trim()) return null;

  const model = utilityModel();
  try {
    const keys = (process.env.ZYLONAI_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
    let response;
    
    if (keys.length > 0) {
      // Use ZyloAI OSS
      const { ChatOpenAI } = require("@langchain/openai");
      const models = keys.map((apiKey: string) => new ChatOpenAI({
        modelName: "gpt-oss",
        apiKey,
        configuration: { baseURL: "https://api.zyloai.net/v1" },
        temperature: 0.4,
        maxTokens: 1200,
        maxRetries: 1,
        modelKwargs: { response_format: { type: "json_object" } }
      }));
      const llm = models.length > 1 ? (models[0] as any).withFallbacks({ fallbacks: models.slice(1) }) : models[0];
      response = await llm.invoke([
        new SystemMessage(WIDGET_CONTENT_SYSTEM_PROMPT),
        new HumanMessage(brief.slice(0, PROMPT_CHAR_BUDGET)),
      ]);
    } else {
      // Fallback to Google
      response = await withGoogleApiRetry(async (apiKey) => {
        const llm = new ChatGoogleGenerativeAI({
          model,
          temperature: 0.4,
          maxRetries: 0,
          maxOutputTokens: 1_200,
          json: true,
          apiKey,
        });
        return llm.invoke([
          new SystemMessage(WIDGET_CONTENT_SYSTEM_PROMPT),
          new HumanMessage(brief.slice(0, PROMPT_CHAR_BUDGET)),
        ]);
      });
    }

    const tokens = extractTokenUsage(response);
    recordModelUsageSafe({
      organizationId,
      requestId: `widget-content-seed:${organizationId}`,
      modelId: model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      forceUnknownPricing:
        tokens.inputTokens === 0 && tokens.outputTokens === 0,
      metadata: { purpose: "widget_content_seed" },
    });

    const raw =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    return validateWidgetContent(parseWidgetContentJson(raw));
  } catch (error) {
    console.warn(
      "[widget-content] generation skipped:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
