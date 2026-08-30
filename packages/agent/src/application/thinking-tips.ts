import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getProviderModel } from "../providers";
import { prompts, THINKING_TIPS_COUNT } from "../lib/prompts";
import { getTipsModel } from "../lib/models";
import { meterModelResponse } from "../infrastructure/metering";

export interface ThinkingTipsResult {
  tips: string[];
  source: "heuristic" | "llm";
}

const TIP_COUNT = THINKING_TIPS_COUNT;
const LLM_TIMEOUT_MS = Number(process.env.THINKING_TIPS_TIMEOUT_MS ?? 700);

const UNIVERSAL_TIPS = [
  "Good questions often reveal the real bottleneck — hang tight.",
  "While I dig in, note what success looks like for you.",
  "Clear goals make AI systems measurably better.",
  "Tip: specific examples beat vague asks every time.",
  "Gathering context so the answer stays useful, not generic.",
  "Almost there — shaping a response you can act on.",
  "Great prompts name the outcome, constraint, and audience.",
  "Checking knowledge that matches your wording…",
];

const TOPIC_TIPS: Array<{ match: RegExp; tips: string[] }> = [
  {
    match: /\b(price|pricing|cost|budget|quote|roi)\b/i,
    tips: [
      "Pricing usually tracks scope, channels, and support level.",
      "Tip: list must-have outcomes before comparing plans.",
      "ROI shows up fastest when one workflow is automated end-to-end.",
      "Ask what is included vs add-on — that avoids surprise costs.",
      "A short discovery call often narrows the right package.",
    ],
  },
  {
    match: /\b(demo|book|schedule|call|meeting|calendly)\b/i,
    tips: [
      "Bring 1–2 real use cases to the demo — results get sharper.",
      "Tip: note current tools and handoff pain points beforehand.",
      "Demos go faster when you share success metrics up front.",
      "We can walk through a flow that matches your team size.",
      "Have stakeholders join if buy-in matters — saves a second call.",
    ],
  },
  {
    match: /\b(agent|multi-?agent|orchestrat|workflow|automat)/i,
    tips: [
      "Agents shine when tools + memory are scoped to one job.",
      "Tip: start with one high-volume repetitive task.",
      "Latency drops when routing picks a small model for simple turns.",
      "Good orchestration separates planning from tool execution.",
      "Guardrails + evals keep multi-agent systems trustworthy.",
    ],
  },
  {
    match: /\b(ai|llm|gemini|gpt|model|chatbot|rag|knowledge|embed)/i,
    tips: [
      "Retrieval quality usually beats raw model size for support Q&A.",
      "Tip: grounded answers need fresh, scoped knowledge chunks.",
      "Flash-class models are great for tips, titles, and routing.",
      "Hallucinations drop when answers cite your own documents.",
      "A clear system prompt beats a longer user prompt for tone.",
    ],
  },
  {
    match: /\b(integrat|api|webhook|crm|slack|whatsapp|channel)/i,
    tips: [
      "Integrations stick when the handoff payload is tiny and typed.",
      "Tip: define the happy path + one failure path before wiring.",
      "Webhooks beat polling for low-latency team alerts.",
      "Map fields once — messy CRM sync is expensive to unwind.",
      "Start with one channel; expand after the loop is reliable.",
    ],
  },
  {
    match: /\b(support|customer|ticket|helpdesk|inbox)/i,
    tips: [
      "Support bots win when they escalate cleanly to humans.",
      "Tip: FAQs + policies in knowledge beat generic chat fluff.",
      "Track deflection rate and CSAT — vanity metrics mislead.",
      "Tone consistency matters as much as factual accuracy.",
      "Short clarifying questions reduce wrong-ticket loops.",
    ],
  },
  {
    match: /\b(neylonai|neylon|service|product|offer|what do you|who are you)\b/i,
    tips: [
      "Neylon AI focuses on practical AI agents for real workflows.",
      "Tip: tell us your industry — examples get more concrete.",
      "Outcomes first: save time, raise conversion, or cut tickets.",
      "We can map a pilot around one measurable KPI.",
      "Curious where AI fits? Start with your noisiest process.",
    ],
  },
];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function uniqueTips(tips: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tip of tips) {
    const cleaned = tip.replace(/\s+/g, " ").trim();
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    out.push(cleaned);
  }
  return out;
}

/** Instant, zero-LLM tips keyed off the query. Always safe to show first. */
export function buildHeuristicTips(question: string): ThinkingTipsResult {
  const matched: string[] = [];
  for (const topic of TOPIC_TIPS) {
    if (topic.match.test(question)) {
      matched.push(...topic.tips);
    }
  }

  const tips = uniqueTips([
    ...shuffle(matched).slice(0, 4),
    ...shuffle(UNIVERSAL_TIPS),
  ]).slice(0, TIP_COUNT);

  return { tips, source: "heuristic" };
}

async function generateLlmTips(question: string): Promise<string[] | null> {
  const tipsModel = getTipsModel();
  const llm = getProviderModel("simple", {
    temperature: 0.7,
    maxTokens: 1000,
    jsonMode: true,
  });
  
  const response = await llm.invoke([
    new SystemMessage(prompts.thinkingTips),
    new HumanMessage(question.slice(0, 400)),
  ]);
  meterModelResponse(tipsModel, response);
  const raw =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
  return parseTips(raw);
}

function parseTips(raw: string): string[] | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { tips?: unknown };
    if (!Array.isArray(parsed.tips)) return null;
    const tips = uniqueTips(
      parsed.tips.filter((t): t is string => typeof t === "string"),
    );
    return tips.length >= 3 ? tips.slice(0, TIP_COUNT) : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/**
 * Low-latency tip pipeline:
 * 1) Instant heuristic tips (call `buildHeuristicTips` and emit immediately)
 * 2) Optional flash-lite refresh with hard timeout — never blocks the agent path
 */
export function startThinkingTipsRefresh(
  question: string,
): Promise<ThinkingTipsResult | null> {
  if (process.env.THINKING_TIPS_LLM === "false") {
    return Promise.resolve(null);
  }

  return withTimeout(generateLlmTips(question), LLM_TIMEOUT_MS).then(
    (tips) => {
      if (!tips?.length) return null;
      return { tips, source: "llm" as const };
    },
  );
}
