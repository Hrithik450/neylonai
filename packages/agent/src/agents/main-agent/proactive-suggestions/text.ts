/**
 * Shared text hygiene for proactive bubbles.
 *
 * Every candidate — hand-written, crawled, or model-generated — passes through
 * `cleanQuestion` / `cleanWelcome` so the bubble UI only ever renders one
 * short, safe, single-emoji line.
 */
import { createHash } from "crypto";

export const BLOCKED =
  /\b(api[_ ]?key|password|secret|token|system prompt|internal only|ssn|credit card)\b/i;

export const BUBBLE_EMOJIS = [
  "✨",
  "👀",
  "🤔",
  "🚀",
  "💡",
  "😊",
  "🔥",
  "💬",
  "👋",
  "⚡",
];

export function stableId(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function normalizeExcerpt(raw: string): string {
  return raw
    .replace(/^content:\s*/i, "")
    .replace(/â€”|â€™/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(q: string): number {
  return q
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[?!.,]+$/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function pickEmoji(seed: string): string {
  const n = parseInt(stableId(seed).slice(0, 2), 16);
  return BUBBLE_EMOJIS[n % BUBBLE_EMOJIS.length]!;
}

export function withEmoji(text: string, seed = text): string {
  const base = text.replace(/\p{Extended_Pictographic}/gu, "").trim();
  const existing = text.match(/\p{Extended_Pictographic}/gu)?.[0];
  return `${base} ${existing ?? pickEmoji(seed)}`.trim();
}

/** Peels quotes off both ends, including smart quotes and doubled-up ones. */
function stripWrappingQuotes(text: string): string {
  let out = text.trim();
  let previous: string;
  do {
    previous = out;
    out = out
      .replace(/^["'“”‘’]+/, "")
      .replace(/["'“”‘’]+$/, "")
      .trim();
  } while (out !== previous);
  return out;
}

/**
 * Splits off the first emoji and drops the rest.
 *
 * Emoji come out *before* any edge-anchored cleanup, so trailing quotes and
 * punctuation are actually at the end of the string when those rules run.
 */
function takeFirstEmoji(text: string): { body: string; emoji: string } {
  const emoji = text.match(/\p{Extended_Pictographic}/u)?.[0] ?? "";
  return {
    body: text.replace(/\p{Extended_Pictographic}/gu, "").trim(),
    emoji,
  };
}

export function cleanWelcome(raw: string): string | null {
  const { body, emoji } = takeFirstEmoji(normalizeExcerpt(raw));
  let q = stripWrappingQuotes(body);
  if (BLOCKED.test(q)) return null;
  if (!/[a-zA-Z]/.test(q)) return null;

  q = q.replace(/[.!?]+$/g, "").trim();
  if (!q) return null;
  q = `${q}!`;

  const words = wordCount(q);
  if (words < 2 || words > 10) return null;

  const final = withEmoji(emoji ? `${q} ${emoji}` : q, raw);
  if (final.length > 72) return null;
  return final;
}

export function cleanQuestion(raw: string): string | null {
  const listStripped = normalizeExcerpt(raw).replace(/^[-*•\d.)\s]+/, "");
  const { body, emoji } = takeFirstEmoji(listStripped);

  // Quotes are peeled on both sides of the "Q:" prefix: models emit both
  // `"Q: ..."` and `Q: "..."`.
  let q = stripWrappingQuotes(body);
  q = q.replace(/^(q|question)\s*[:.)\-]\s*/i, "");
  q = stripWrappingQuotes(q);

  if (BLOCKED.test(q)) return null;
  if (!/[a-zA-Z]/.test(q)) return null;
  if (/navigation path|^\s*\/|https?:/i.test(q)) return null;

  q = q.replace(/[.!]+$/g, "").trim();
  if (!q) return null;
  if (!/\?$/.test(q)) q = `${q}?`;

  // Shape checks run on the emoji-free text so the anchors match.
  const words = wordCount(q);
  if (words < 3 || words > 10) return null;
  if (/\b(of|the|and|a|an|to|for|in|with|our)\?$/i.test(q)) return null;

  const final = withEmoji(emoji ? `${q} ${emoji}` : q, raw);
  if (final.length > 72) return null;
  return final;
}

/** Comparison key that ignores emoji/punctuation, for de-duplication. */
export function bubbleDedupeKey(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
