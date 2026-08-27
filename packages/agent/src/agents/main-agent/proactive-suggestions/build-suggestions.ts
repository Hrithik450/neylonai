import {
  getKnowledgePageText,
  listKnowledgeSuggestionSeeds,
  cacheGet,
  cacheSet,
  type KnowledgeSuggestionSeed,
} from "@neylonai/database";
import { listAllowedSourceIds } from "@neylonai/domain/knowledge";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createHash } from "crypto";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";
import { prompts } from "../../../lib/prompts";
import { getUtilityModel } from "../../../lib/models";
import { meterModelResponse } from "../../../infrastructure/metering";
import {
  getBuiltInPageSuggestions,
  getBuiltInPageWelcomeMessages,
  WELCOME_BACK_MESSAGES,
} from "./page-suggestions";
import { generateProactiveCandidates } from "./generate-candidates";
import {
  bubbleDedupeKey,
  cleanQuestion,
  cleanWelcome,
  normalizeExcerpt,
  stableId,
  wordCount,
} from "./text";

export type SuggestionSource =
  | "welcome"
  | "welcome_back"
  | "recent_conversation"
  | "page"
  | "knowledge";

export interface ProactiveSuggestion {
  id: string;
  text: string;
  source: SuggestionSource;
  contextKey?: string;
}

export interface BuildSuggestionsInput {
  /** Mandatory tenant scope — never resolve another org via env slug. */
  organizationId: string;
  pagePath?: string | null;
  /** Full URL when available (hostname/path tokens improve page ranking). */
  pageUrl?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  mode?: "idle" | "post_chat" | "fallback";
  /** Final personalized pool size (clamped 3–5 for idle, exactly 1 for post_chat). */
  limit?: number;
  /** Anonymous visitor id (localStorage). */
  visitorId?: string | null;
  /** Tab/session id (sessionStorage). */
  sessionId?: string | null;
  /** Already shown / dismissed suggestion ids — skip. */
  excludeIds?: string[];
  /** True on the visitor's first-ever proactive session. */
  isFirstVisit?: boolean;
  /** True when a returning visitor starts a new tab session. */
  isReturningSession?: boolean;
}

/** Page suggestions delivered per tab session (excluding welcome bubbles). */
const SESSION_BATCH_SIZE = 4;
/** One bubble per completed support-widget interaction. */
const POST_CHAT_SUGGESTION_COUNT = 1;
const FALLBACK_BATCH_SIZE = 5;

const PERSONALIZED_CACHE_TTL_SEC = 90;
const SEED_CANDIDATE_LIMIT = 28;

/** Ranking bonuses by provenance — model-written, grounded lines lead. */
const BONUS_MODEL = 6;
const BONUS_BUILT_IN_PAGE = 2;

function requireTenantId(name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required for proactive suggestions`);
  }
  return trimmed;
}

/**
 * Ids are derived from the bubble text alone, so the same question can never
 * reappear under a second id after the visitor has already seen it.
 */
function suggestionId(text: string): string {
  return stableId(bubbleDedupeKey(text) || text);
}

function makeWelcome(
  visitorKey: string,
  pagePath?: string | null,
): ProactiveSuggestion {
  const messages = getBuiltInPageWelcomeMessages(pagePath);
  const idx =
    parseInt(stableId(`welcome:${visitorKey}:${pagePath ?? "/"}`).slice(0, 4), 16) %
    messages.length;
  const pick = messages[idx]!;
  const text = cleanWelcome(pick) ?? "Hey there — welcome! 👋";
  return { id: "welcome", text, source: "welcome" };
}

function makeWelcomeBack(visitorKey: string): ProactiveSuggestion {
  const idx =
    parseInt(stableId(`welcome-back:${visitorKey}`).slice(0, 4), 16) %
    WELCOME_BACK_MESSAGES.length;
  const pick = WELCOME_BACK_MESSAGES[idx]!;
  const text = cleanWelcome(pick) ?? "Welcome back! 👋";
  return { id: "welcome-back", text, source: "welcome_back" };
}

const BRAND_CATCHY_HOOKS = [
  "Curious what we can build together? ✨",
  "Ready for AI that actually delivers? 🚀",
  "Shall we leave the ordinary behind? 👀",
  "Want the unfair advantage? 🔥",
  "Is your stack holding you back? 🤔",
  "Curious why teams switch to us? 💡",
  "Ready to automate the boring stuff? ⚡",
  "Want support that never sleeps? 💬",
];

const QUESTION_LEAD =
  /^(how|what|who|when|where|why|which|is|are|can|could|do|does|did|will|would|should|have|has)\b/i;

function nounTopic(raw: string): string | null {
  let t = normalizeExcerpt(raw)
    .replace(/\?$/, "")
    .replace(/^(?:what|who)\s+is\s+/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .trim();
  if (QUESTION_LEAD.test(t)) return null;
  t = t
    .split(/\s+/)
    .filter((w) => !/^(and|or|of|to|for|in|on|with|our|your)$/i.test(w))
    .slice(0, 3)
    .join(" ")
    .trim();
  if (t.length < 3 || t.length > 28) return null;
  if (!/^[A-Za-z][A-Za-z0-9 &/+'-]*$/.test(t)) return null;
  return t;
}

function topicCatchyHooks(topic: string): string[] {
  const t = nounTopic(topic);
  if (!t) return [];
  return [
    `Curious about ${t}? 🤔`,
    `Is ${t} your missing edge? ✨`,
    `Ready to unlock ${t}? 🚀`,
    `What if ${t} changed everything? 👀`,
  ];
}

function themeCatchyHooks(text: string): string[] {
  const hooks: string[] = [];
  if (/pric|cost|plan|budget/i.test(text)) {
    hooks.push("Curious what real value costs? 💰", "Ready to talk real pricing? 🤔");
  }
  if (/demo|book|schedule|call|consult/i.test(text)) {
    hooks.push("Want to see us in action? 👀", "Shall we book a quick demo? 🚀");
  }
  if (/support|widget|agent|customer|chat/i.test(text)) {
    hooks.push("Tired of slow customer support? 😤", "Want support that never sleeps? 💬");
  }
  if (/automat|workflow|orchestr|multi-?agent/i.test(text)) {
    hooks.push("Ready to automate the boring stuff? ⚡", "Still doing this manually? 👀");
  }
  if (/compet|better|unique|different|only/i.test(text)) {
    hooks.push("Know why we're hard to beat? 🔥", "Looking for a real difference? ✨");
  }
  return hooks;
}

function toCatchyVariants(topicOrQuestion: string): string[] {
  const raw = normalizeExcerpt(topicOrQuestion).replace(/\?$/, "").trim();
  if (!raw) return [];
  return [...themeCatchyHooks(raw), ...topicCatchyHooks(raw)]
    .map((h) => cleanQuestion(h))
    .filter((h): h is string => Boolean(h));
}

function titleToQuestions(title: string): string[] {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length < 4 || t.length > 80) return [];
  return toCatchyVariants(t);
}

function extractFaqQuestions(excerpt: string): string[] {
  const text = normalizeExcerpt(excerpt);
  const out: string[] = [];
  const faqRe =
    /(?:^|\n|\.\s*|content:\s*)?(?:Q(?:uestion)?\s*[:.)\-]\s*)([^?\n]{6,48}\?)/gi;
  let match: RegExpExecArray | null;
  while ((match = faqRe.exec(text)) !== null) {
    const faq = match[1] ?? "";
    out.push(...toCatchyVariants(faq), ...themeCatchyHooks(faq));
  }
  if (out.length === 0) {
    out.push(...themeCatchyHooks(text));
    const bare = text.match(/(?:^|[.!\n]\s+)([A-Z][^?\n]{6,48}\?)/g) ?? [];
    for (const raw of bare.slice(0, 2)) {
      out.push(...toCatchyVariants(raw.replace(/^[.!\n]\s+/, "")));
    }
  }
  return out;
}

function excerptToQuestion(excerpt: string): string | null {
  const text = normalizeExcerpt(excerpt);
  if (text.length < 28) return null;
  if (/\bQ(?:uestion)?\s*[:.)\-]/i.test(text)) return null;
  const lead =
    text.match(
      /^([A-Z][A-Za-z0-9 &/+'-]{2,40})(?:\s+[—\-–,|:]\s+|\s+is\s+|\s+are\s+)/,
    )?.[1] ?? null;
  if (lead && lead.length >= 4 && lead.length <= 28) {
    return toCatchyVariants(lead)[0] ?? null;
  }
  return null;
}

/** Expand a KB seed into catchy candidate strings (deterministic, no LLM). */
export function seedToCandidateTexts(seed: KnowledgeSuggestionSeed): string[] {
  const texts: string[] = [];
  if (seed.title) texts.push(...titleToQuestions(seed.title));
  texts.push(...extractFaqQuestions(seed.excerpt), ...themeCatchyHooks(seed.excerpt));
  if (texts.length === 0) {
    const fallback = excerptToQuestion(seed.excerpt);
    if (fallback) texts.push(fallback);
  }
  return texts;
}

function catchyScore(text: string): number {
  let score = 0;
  if (/^(serious|ready|still|think|done|want|is your|curious)\b/i.test(text)) score += 5;
  if (/\b(competitor|competitors|beats|average|switch|unlock|edge)\b/i.test(text)) score += 3;
  if (/\p{Extended_Pictographic}/u.test(text)) score += 2;
  if (/^(what is|who is|how quickly)\b/i.test(text)) score -= 4;
  const words = wordCount(text);
  score += Math.max(0, 3 - Math.abs(words - 6));
  return score;
}

function pathTokens(...parts: Array<string | null | undefined>): string[] {
  const joined = parts.filter(Boolean).join(" ");
  if (!joined) return [];
  return joined
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length > 2 &&
        !["www", "http", "https", "com", "app", "page", "html", "index"].includes(
          t,
        ),
    );
}

function scoreForPage(haystack: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const lower = haystack.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (lower.includes(t)) score += 3;
  }
  return score;
}

function conversationTokens(
  messages: Array<{ role: string; content: string }>,
): string[] {
  const blob = messages
    .slice(-8)
    .map((m) => m.content)
    .join(" ");
  return pathTokens(blob).slice(0, 24);
}

function visitorJitter(visitorKey: string, candidateId: string): number {
  const n = parseInt(stableId(`${visitorKey}:${candidateId}`).slice(0, 6), 16);
  return (n % 1000) / 1000;
}

function uniqueSuggestions(
  items: ProactiveSuggestion[],
  limit: number,
): ProactiveSuggestion[] {
  const seen = new Set<string>();
  const out: ProactiveSuggestion[] = [];
  for (const item of items) {
    const key =
      item.source === "welcome" || item.source === "welcome_back"
        ? item.source
        : bubbleDedupeKey(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

interface Candidate {
  suggestion: ProactiveSuggestion;
  /** Text the page/conversation token scores are matched against. */
  seedHaystack: string;
  /** Provenance bonus — grounded, model-written lines outrank templates. */
  bonus: number;
}

type RankedCandidate = ProactiveSuggestion & { score: number };

function textsToCandidates(
  texts: string[],
  options: {
    source: SuggestionSource;
    bonus: number;
    pagePath?: string | null;
    extraHaystack?: string;
  },
): Candidate[] {
  const out: Candidate[] = [];
  for (const text of texts) {
    const cleaned = cleanQuestion(text);
    if (!cleaned) continue;
    out.push({
      suggestion: {
        id: suggestionId(cleaned),
        text: cleaned,
        source: options.source,
        ...(options.pagePath ? { contextKey: options.pagePath } : {}),
      },
      seedHaystack: `${cleaned} ${options.extraHaystack ?? ""}`.trim(),
      bonus: options.bonus,
    });
  }
  return out;
}

function seedsToCandidates(seeds: KnowledgeSuggestionSeed[]): Candidate[] {
  const out: Candidate[] = [
    ...textsToCandidates(BRAND_CATCHY_HOOKS, {
      source: "knowledge",
      bonus: 0,
    }),
  ];
  const brandKeys = new Set(
    out.map((candidate) => bubbleDedupeKey(candidate.suggestion.text)),
  );

  for (const seed of seeds) {
    for (const candidate of textsToCandidates(seedToCandidateTexts(seed), {
      source: "knowledge",
      bonus: 0,
      extraHaystack: `${seed.title ?? ""} ${seed.excerpt}`,
    })) {
      if (brandKeys.has(bubbleDedupeKey(candidate.suggestion.text))) continue;
      out.push(candidate);
    }
  }

  return out;
}

function rankCandidatesForVisitor(params: {
  candidates: Candidate[];
  pagePath?: string | null;
  pageUrl?: string | null;
  recentMessages: Array<{ role: string; content: string }>;
  excludeIds: Set<string>;
  visitorKey: string;
}): RankedCandidate[] {
  const pageToks = pathTokens(params.pagePath, params.pageUrl);
  const convToks = conversationTokens(params.recentMessages);
  const ranked: RankedCandidate[] = [];

  for (const { suggestion, seedHaystack, bonus } of params.candidates) {
    if (params.excludeIds.has(suggestion.id)) continue;
    const pageScore = scoreForPage(seedHaystack, pageToks);
    const convScore = scoreForPage(seedHaystack, convToks);
    const source: SuggestionSource =
      suggestion.source === "page" || pageScore > 0 ? "page" : suggestion.source;
    ranked.push({
      ...suggestion,
      source,
      score:
        bonus +
        pageScore * 4 +
        convScore * 2 +
        catchyScore(suggestion.text) +
        visitorJitter(params.visitorKey, suggestion.id),
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

async function aiFollowUps(
  recentMessages: Array<{ role: string; content: string }>,
): Promise<string[]> {
  const transcript = recentMessages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 280)}`)
    .join("\n");
  if (transcript.length < 40) return [];

  try {
    const utilityModel = getUtilityModel();
    const response = await withGoogleApiRetry(async (apiKey) => {
      const llm = new ChatGoogleGenerativeAI({
        model: utilityModel,
        temperature: 0.6,
        maxRetries: 0,
        maxOutputTokens: 180,
        json: true,
        apiKey,
      });
      return llm.invoke([
        new SystemMessage(prompts.proactiveFollowUps),
        new HumanMessage(transcript.slice(0, 4_800)),
      ]);
    });
    meterModelResponse(utilityModel, response, {
      metadata: { purpose: "proactive_followups" },
    });
    const raw =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { suggestions?: unknown };
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions
      .filter((s): s is string => typeof s === "string")
      .map((s) => cleanQuestion(s))
      .filter((s): s is string => Boolean(s))
      .slice(0, POST_CHAT_SUGGESTION_COUNT);
  } catch (error) {
    console.warn(
      "[proactive-suggestions] AI follow-ups skipped:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function historyFollowUps(
  recentMessages: Array<{ role: string; content: string }>,
): ProactiveSuggestion[] {
  const out: ProactiveSuggestion[] = [];
  const users = recentMessages.filter((m) => m.role === "user").slice(-2);
  for (const msg of users.reverse()) {
    const topic = nounTopic(msg.content);
    if (!topic) continue;
    for (const text of [
      `Still thinking about ${topic}? 👀`,
      `Curious to dig into ${topic}? 🤔`,
    ]) {
      const cleaned = cleanQuestion(text);
      if (!cleaned) continue;
      out.push({
        id: suggestionId(`conv:${cleaned}`),
        text: cleaned,
        source: "recent_conversation",
      });
      if (out.length >= POST_CHAT_SUGGESTION_COUNT) return out;
    }
  }
  return out;
}

function personalizedCacheKey(input: {
  organizationId: string;
  mode: string;
  pagePath: string;
  pageUrl: string;
  visitorKey: string;
  excludeIds: string[];
  messageFingerprint: string;
  flagsFingerprint: string;
  limit: number;
}): string {
  const payload = [
    input.organizationId,
    input.mode,
    input.pagePath,
    input.pageUrl,
    input.visitorKey,
    input.excludeIds.slice().sort().join(","),
    input.messageFingerprint,
    input.flagsFingerprint,
    String(input.limit),
  ].join("|");
  const digest = createHash("sha256").update(payload).digest("hex").slice(0, 32);
  return `proactive-suggestions:v4:${digest}`;
}

function messageFingerprint(
  messages: Array<{ role: string; content: string }>,
): string {
  if (!messages.length) return "none";
  return createHash("sha256")
    .update(
      messages
        .slice(-8)
        .map((m) => `${m.role}:${m.content.slice(0, 120)}`)
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 16);
}

/** The crawled text of this exact page — grounds page-specific bubbles. */
async function resolvePageText(
  organizationId: string,
  pagePath: string,
): Promise<string> {
  try {
    const sourceIds = await listAllowedSourceIds(organizationId, "main-agent");
    if (!sourceIds.length) return "";
    return await getKnowledgePageText({
      organizationId,
      sourceIds,
      canonicalPath: pagePath,
    });
  } catch {
    return "";
  }
}

/**
 * The visitor-facing pool for idle/fallback modes: model-written bubbles
 * grounded in the org's knowledge base, then crawled page suggestions, then
 * deterministic hooks as backfill — all ranked for this visitor and page.
 */
async function buildContextualPool(params: {
  organizationId: string;
  pagePath: string;
  pageUrl?: string | null;
  rawPagePath?: string | null;
  recentMessages: Array<{ role: string; content: string }>;
  excludeIds: Set<string>;
  visitorKey: string;
  limit: number;
}): Promise<ProactiveSuggestion[]> {
  const [pageText, seeds] = await Promise.all([
    resolvePageText(params.organizationId, params.pagePath),
    listKnowledgeSuggestionSeeds({
      organizationId: params.organizationId,
      limit: SEED_CANDIDATE_LIMIT,
    }),
  ]);

  const modelTexts = await generateProactiveCandidates({
    organizationId: params.organizationId,
    pagePath: params.pagePath,
    pageUrl: params.pageUrl,
    seeds,
    // The page's own crawled text — never the built-in catalog, which is this
    // product's own copy and must not ground another tenant's bubbles.
    pageText,
    // This visitor's own recent questions, so idle bubbles anticipate their
    // next question — not just what the page says. Only present for returning/
    // mid-session visitors, so brand-new visitors keep the shared org+page cache.
    recentUserAsks: params.recentMessages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .slice(-3),
  });

  const candidates: Candidate[] = [
    ...textsToCandidates(modelTexts, {
      source: "knowledge",
      bonus: BONUS_MODEL,
      pagePath: params.pagePath,
    }),
    ...textsToCandidates(getBuiltInPageSuggestions(params.pagePath), {
      source: "page",
      bonus: BONUS_BUILT_IN_PAGE,
      pagePath: params.pagePath,
    }),
    ...seedsToCandidates(seeds),
  ];

  const ranked = rankCandidatesForVisitor({
    candidates,
    pagePath: params.rawPagePath,
    pageUrl: params.pageUrl,
    recentMessages: params.recentMessages,
    excludeIds: params.excludeIds,
    visitorKey: params.visitorKey,
  });

  return uniqueSuggestions(
    ranked.map(({ score: _score, ...suggestion }) => suggestion),
    params.limit,
  );
}

export interface ProactiveSuggestionsResult {
  suggestions: ProactiveSuggestion[];
}

/**
 * Per-page catalogs + visitor context → short proactive suggestion lists.
 */
export async function buildProactiveSuggestions(
  input: BuildSuggestionsInput,
): Promise<ProactiveSuggestionsResult> {
  const organizationId = requireTenantId("organizationId", input.organizationId);
  const mode =
    input.mode === "post_chat"
      ? "post_chat"
      : input.mode === "fallback"
        ? "fallback"
        : "idle";
  const recentMessages = Array.isArray(input.recentMessages)
    ? input.recentMessages
    : [];
  const excludeIds = new Set(
    (input.excludeIds ?? []).map((id) => id.trim()).filter(Boolean),
  );
  const visitorKey =
    input.visitorId?.trim() ||
    input.sessionId?.trim() ||
    "anonymous";
  const pagePath = (input.pagePath ?? "/").trim() || "/";
  const pageUrl = input.pageUrl ?? "";
  const msgFp = messageFingerprint(recentMessages);
  const flagsFingerprint = [
    input.isFirstVisit ? "first" : "returning",
    input.isReturningSession ? "new-session" : "same-session",
  ].join(":");

  const limit =
    mode === "post_chat"
      ? POST_CHAT_SUGGESTION_COUNT
      : mode === "fallback"
        ? FALLBACK_BATCH_SIZE
        : Math.min(Math.max(input.limit ?? SESSION_BATCH_SIZE, 4), 5);

  const canCachePersonalized = Boolean(
    input.visitorId?.trim() || input.sessionId?.trim(),
  );
  const cacheKey = canCachePersonalized
    ? personalizedCacheKey({
        organizationId,
        mode,
        pagePath,
        pageUrl,
        visitorKey,
        excludeIds: [...excludeIds],
        messageFingerprint: msgFp,
        flagsFingerprint,
        limit,
      })
    : null;

  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ProactiveSuggestion[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { suggestions: parsed };
        }
      } catch {
        // ignore
      }
    }
  }

  if (mode === "post_chat") {
    const conversationSuggestions: ProactiveSuggestion[] = [];
    if (recentMessages.length >= 2) {
      for (const text of await aiFollowUps(recentMessages)) {
        const suggestion: ProactiveSuggestion = {
          id: suggestionId(`conv:${text}`),
          text,
          source: "recent_conversation",
          contextKey: pagePath,
        };
        if (excludeIds.has(suggestion.id)) continue;
        conversationSuggestions.push(suggestion);
      }
    }
    if (conversationSuggestions.length < POST_CHAT_SUGGESTION_COUNT) {
      for (const item of historyFollowUps(recentMessages)) {
        if (excludeIds.has(item.id)) continue;
        if (conversationSuggestions.some((s) => s.text === item.text)) continue;
        conversationSuggestions.push(item);
        if (conversationSuggestions.length >= POST_CHAT_SUGGESTION_COUNT) break;
      }
    }
    const result = uniqueSuggestions(
      conversationSuggestions,
      POST_CHAT_SUGGESTION_COUNT,
    );
    if (cacheKey) {
      await cacheSet(cacheKey, JSON.stringify(result), PERSONALIZED_CACHE_TTL_SEC);
    }
    return { suggestions: result };
  }

  const contextual = await buildContextualPool({
    organizationId,
    pagePath,
    pageUrl: input.pageUrl,
    rawPagePath: input.pagePath,
    recentMessages,
    excludeIds,
    visitorKey,
    limit: mode === "fallback" ? FALLBACK_BATCH_SIZE : Math.max(limit, SESSION_BATCH_SIZE),
  });

  const prefix: ProactiveSuggestion[] = [];
  if (mode === "idle") {
    if (input.isFirstVisit) {
      prefix.push(makeWelcome(visitorKey, pagePath));
    } else if (input.isReturningSession) {
      prefix.push(makeWelcomeBack(visitorKey));
    }
  }

  const result = uniqueSuggestions(
    [...prefix, ...contextual],
    prefix.length + contextual.length,
  );

  if (cacheKey) {
    await cacheSet(cacheKey, JSON.stringify(result), PERSONALIZED_CACHE_TTL_SEC);
  }

  return { suggestions: result };
}
