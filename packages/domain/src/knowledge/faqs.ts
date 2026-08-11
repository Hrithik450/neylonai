import { and, eq } from "drizzle-orm";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
} from "@neylonai/database";

export type DerivedKnowledgeFaq = {
  question: string;
  answer: string;
};

function cleanContent(raw: string): string {
  return raw
    .replace(/^content:\s*/i, "")
    .replace(/\bupdated_at:\s*\S+/gi, "")
    .replace(/\btitle:\s*[^\n.]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowQualityKnowledge(text: string): boolean {
  return (
    /^navigation path:/i.test(text) ||
    /\blanding page introducing\b/i.test(text) ||
    /\bcta buttons?:\b/i.test(text) ||
    text.length < 40
  );
}

function normalizeQuestion(raw: string): string | null {
  const cleaned = raw
    .replace(/^\s*(?:q(?:uestion)?\s*[:.)\-]|[#*\d]+[.)\-:]\s*)/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?？]+$/u, "");
  if (cleaned.length < 8 || cleaned.length > 120) return null;
  if (!/[A-Za-z]/.test(cleaned)) return null;
  return `${cleaned}?`;
}

function normalizeAnswer(raw: string): string | null {
  const cleaned = cleanContent(raw)
    .replace(/^\s*(?:a(?:nswer)?\s*[:.)\-])\s*/i, "")
    .trim();
  if (cleaned.length < 12) return null;
  if (cleaned.length <= 360) return cleaned;
  return `${cleaned.slice(0, 360).replace(/\s+\S*$/, "")}…`;
}

function isQuestionLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^(a|answer)\s*[:.)\-]/i.test(t)) return false;
  if (/^(?:q(?:uestion)?\s*[:.)\-]|[#*]+\s*|\d+[.)]\s+)/i.test(t)) {
    return t.includes("?") || t.length >= 8;
  }
  return /[?？]$/u.test(t);
}

function stripQuestionPrefix(line: string): string {
  return line
    .trim()
    .replace(/^(?:q(?:uestion)?\s*[:.)\-]|[#*]+\s*|\d+[.)]\s+)/i, "")
    .trim();
}

/**
 * Extract Q&A pairs from pasted FAQ / knowledge text.
 */
export function extractFaqPairsFromText(
  text: string,
  limit = 4,
): Array<{ question: string; answer: string }> {
  const source = text.replace(/\r\n/g, "\n").trim();
  if (!source) return [];

  const lines = source.split("\n").map((l) => l.trim());
  const pairs: Array<{ question: string; answer: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!isQuestionLine(line)) continue;

    const question = normalizeQuestion(stripQuestionPrefix(line));
    if (!question) continue;

    const answerParts: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j] ?? "";
      if (!next) {
        if (answerParts.length > 0) break;
        j++;
        continue;
      }
      if (isQuestionLine(next)) break;
      answerParts.push(next);
      j++;
      if (answerParts.join(" ").length > 600) break;
    }

    const answer = normalizeAnswer(answerParts.join(" "));
    if (!answer) continue;
    if (
      pairs.some((p) => p.question.toLowerCase() === question.toLowerCase())
    ) {
      continue;
    }

    pairs.push({ question, answer });
    if (pairs.length >= limit) break;
    i = j - 1;
  }

  return pairs;
}

/** Turn narrative knowledge into a customer-facing FAQ when no Q:/A: markup exists. */
function narrativeToFaq(
  text: string,
): { question: string; answer: string } | null {
  const cleaned = cleanContent(text);
  if (isLowQualityKnowledge(cleaned)) return null;

  const explicit = extractFaqPairsFromText(cleaned, 1)[0];
  if (explicit) return explicit;

  const rules: Array<[RegExp, string]> = [
    [/\b(pric(?:e|ing)|cost|plan|subscription|consult)/i, "What are the pricing options?"],
    [/\b(integrat|website|embed|support widget|ask ai)\b/i, "Can this work with my existing website?"],
    [/\b(enterprise|b2b|consumer|segment)\b/i, "Who is this built for?"],
    [/\b(ai agents?|assistant|automat)/i, "What can the AI agent do?"],
    [/\b(secur|privacy|encrypt|compliance)\b/i, "Is my business data secure?"],
    [/\b(get started|onboard(?:ing)?|set\s*up)\b/i, "How do I get started?"],
    [/\b(human support|escalat|handoff|notify your team)\b/i, "What happens when a customer needs human support?"],
    [/\b(service categor|offers? several|custom ai)\b/i, "What services do you offer?"],
    [/\b(career assistant|resume coach|scholarship finder|skill gap)\b/i, "What consumer AI assistants do you offer?"],
  ];

  let question: string | null = null;
  for (const [re, q] of rules) {
    if (re.test(cleaned)) {
      question = q;
      break;
    }
  }
  if (!question) return null;

  const answer = normalizeAnswer(cleaned);
  if (!answer || answer.length < 60) return null;
  if (/^(social links|youtube|linkedin|instagram|github)\b/i.test(answer)) {
    return null;
  }
  return { question, answer };
}

/**
 * One-way seed helper: derive up to `limit` FAQs from org knowledge.
 * Used only to initialize widget config — never syncs edits back to knowledge.
 */
export async function deriveFaqsFromOrgKnowledge(
  organizationId: string,
  limit = 4,
): Promise<DerivedKnowledgeFaq[]> {
  const max = Math.min(Math.max(limit, 1), 4);
  const pairs: Array<{ question: string; answer: string }> = [];

  const pushPair = (question: string, answer: string) => {
    if (pairs.some((p) => p.question.toLowerCase() === question.toLowerCase())) {
      return false;
    }
    pairs.push({ question, answer });
    return true;
  };

  const chunks = await db
    .select({
      content: knowledgeChunks.content,
      title: knowledgeDocuments.name,
    })
    .from(knowledgeChunks)
    .innerJoin(
      knowledgeDocuments,
      and(
        eq(knowledgeDocuments.id, knowledgeChunks.document_id),
        eq(knowledgeDocuments.organization_id, organizationId),
      ),
    )
    .where(eq(knowledgeChunks.organization_id, organizationId))
    .orderBy(knowledgeChunks.chunk_index)
    .limit(40);

  for (const row of chunks) {
    if (pairs.length >= max) break;
    if (row.title?.includes("?")) {
      const question = normalizeQuestion(row.title);
      const answer = normalizeAnswer(row.content);
      if (question && answer) {
        pushPair(question, answer);
      }
    }

    const derived = narrativeToFaq(row.content);
    if (derived) pushPair(derived.question, derived.answer);
  }

  return pairs.slice(0, max);
}
