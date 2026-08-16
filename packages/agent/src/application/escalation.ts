import type { EscalationTrigger } from "@neylonai/domain";

export interface EscalationDecision {
  shouldEscalate: boolean;
  trigger: EscalationTrigger | null;
  reason: string | null;
}

const HUMAN_PATTERNS =
  /\b(talk to (a )?human|speak (to|with) (a )?(human|person|agent|someone)|real person|customer service|live agent|human please|transfer me|escalate)\b/i;

const FRUSTRATION_PATTERNS =
  /\b(this (is|isn'?t|ain'?t) (helping|useful|working)|useless|frustrated|angry|ridiculous|worst|hate this|so annoying)\b/i;

const UNHELPFUL_PATTERNS =
  /\b(that didn'?t help|still (doesn'?t|does not) (work|help)|you already said|same answer|not what i asked)\b/i;

/**
 * Deterministic escalation signals — no model chain-of-thought.
 * MVP: always-on heuristics (no per-org escalation config).
 */
export function detectEscalation(
  userInput: string,
  history: Array<{ role: string; content: string }>,
): EscalationDecision {
  const text = userInput.trim();

  if (HUMAN_PATTERNS.test(text)) {
    return {
      shouldEscalate: true,
      trigger: "customer_request",
      reason: "Customer asked to speak with a human",
    };
  }

  if (FRUSTRATION_PATTERNS.test(text)) {
    return {
      shouldEscalate: true,
      trigger: "frustration",
      reason: "Customer expressed strong frustration",
    };
  }

  if (UNHELPFUL_PATTERNS.test(text)) {
    const priorUnhelpful = history.filter(
      (m) => m.role === "user" && UNHELPFUL_PATTERNS.test(m.content),
    ).length;
    if (priorUnhelpful >= 1) {
      return {
        shouldEscalate: true,
        trigger: "unhelpful",
        reason: "Customer indicated answers were not helping",
      };
    }
  }

  return { shouldEscalate: false, trigger: null, reason: null };
}

/** Build a short operator summary from recent messages (no private reasoning). */
export function buildHandoffSummary(
  history: Array<{ role: string; content: string }>,
  latestUserInput: string,
): string {
  const recent = [...history.slice(-6), { role: "user", content: latestUserInput }]
    .map((m) => {
      const who = m.role === "user" ? "Customer" : "AI";
      const clip = m.content.replace(/\s+/g, " ").slice(0, 140);
      return `${who}: ${clip}`;
    })
    .join("\n");
  return recent || `Customer: ${latestUserInput.slice(0, 200)}`;
}
