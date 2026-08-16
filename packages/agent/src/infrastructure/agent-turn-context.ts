import { AsyncLocalStorage } from "node:async_hooks";
import type { ProvenanceChunkHit } from "@neylonai/domain/knowledge";
import type { AiCreditClass, TurnCreditEstimate } from "@neylonai/domain/billing";

/**
 * Per-request tool context. Avoids module-level mutable state that races
 * when multiple conversations run concurrently in the same process.
 */
export type AgentTurnContextStore = {
  threadId?: string;
  organizationId?: string;
  agentId?: string;
  /** Correlates all model/tool usage for one HTTP request. */
  requestId?: string;
  apiKeyId?: string;
  pagePath?: string;
  /** Accumulated RAG hits for this turn (dashboard provenance). */
  provenanceHits?: ProvenanceChunkHit[];
  /** Credit / rollup signals for this turn. */
  billing?: {
    complexityTier?: "low" | "medium" | "high" | null;
    workloadClass?: AiCreditClass | null;
    routeSource?: "heuristic" | "classifier" | "fallback" | null;
    routedModel?: string | null;
    agentRounds: number;
    toolsUsed: string[];
    semanticSearchCount: number;
    ragTokens: number;
    databaseRows: number;
    capped: boolean;
    capReason?: string | null;
    estimate?: TurnCreditEstimate | null;
  };
};

const storage = new AsyncLocalStorage<AgentTurnContextStore>();

export function getAgentTurnContext(): AgentTurnContextStore {
  return storage.getStore() ?? {};
}

export function patchAgentTurnContext(
  patch: Partial<AgentTurnContextStore>,
): void {
  const store = storage.getStore();
  if (!store) return;
  Object.assign(store, patch);
}

function ensureBilling() {
  const store = storage.getStore();
  if (!store) return null;
  if (!store.billing) {
    store.billing = {
      agentRounds: 0,
      toolsUsed: [],
      semanticSearchCount: 0,
      ragTokens: 0,
      databaseRows: 0,
      capped: false,
    };
  }
  return store.billing;
}

export function recordRoutedModel(input: {
  model: string;
  complexity: "low" | "medium" | "high";
  source: "heuristic" | "classifier" | "fallback";
  workloadClass?: AiCreditClass;
}): void {
  const billing = ensureBilling();
  if (!billing) return;
  billing.routedModel = input.model;
  billing.complexityTier = input.complexity;
  billing.routeSource = input.source;
  if (input.workloadClass) billing.workloadClass = input.workloadClass;
}

export function recordCreditEstimate(estimate: TurnCreditEstimate): void {
  const billing = ensureBilling();
  if (!billing) return;
  billing.estimate = estimate;
}

export function recordAgentRound(): void {
  const billing = ensureBilling();
  if (!billing) return;
  billing.agentRounds += 1;
}

export function recordToolUse(toolName: string): void {
  const billing = ensureBilling();
  if (!billing) return;
  billing.toolsUsed.push(toolName);
}

export function recordSemanticSearch(): number {
  const billing = ensureBilling();
  if (!billing) return 0;
  billing.semanticSearchCount += 1;
  return billing.semanticSearchCount;
}

export function recordRagOutput(chars: number): void {
  const billing = ensureBilling();
  if (billing) billing.ragTokens += Math.ceil(Math.max(0, chars) / 4);
}

export function recordDatabaseRows(rows: number): void {
  const billing = ensureBilling();
  if (billing) billing.databaseRows += Math.max(0, Math.floor(rows));
}

export function markTurnCapped(reason: string): void {
  const billing = ensureBilling();
  if (!billing) return;
  billing.capped = true;
  billing.capReason = reason;
}

export function getTurnBillingSignals() {
  return (
    getAgentTurnContext().billing ?? {
      agentRounds: 0,
      toolsUsed: [] as string[],
      semanticSearchCount: 0,
      ragTokens: 0,
      databaseRows: 0,
      capped: false,
    }
  );
}

/** Append structured retrieval hits for later assistant-message provenance. */
export function appendProvenanceHits(hits: ProvenanceChunkHit[]): void {
  const store = storage.getStore();
  if (!store || hits.length === 0) return;
  store.provenanceHits = [...(store.provenanceHits ?? []), ...hits];
}

export function takeProvenanceHits(): ProvenanceChunkHit[] {
  const store = storage.getStore();
  if (!store?.provenanceHits?.length) return [];
  const hits = store.provenanceHits;
  store.provenanceHits = [];
  return hits;
}

/**
 * Re-enters ALS on every async-generator resume so tool calls after `await`
 * / `yield` still see the turn context.
 */
export async function* withAgentTurnContext<T>(
  ctx: AgentTurnContextStore,
  generator: AsyncGenerator<T>,
): AsyncGenerator<T> {
  const store: AgentTurnContextStore = {
    ...ctx,
    provenanceHits: [],
    billing: {
      agentRounds: 0,
      toolsUsed: [],
      semanticSearchCount: 0,
      ragTokens: 0,
      databaseRows: 0,
      capped: false,
    },
  };
  while (true) {
    const step = await storage.run(store, () => generator.next());
    if (step.done) return;
    yield step.value;
  }
}

/** Run an async function inside turn context (non-streaming paths). */
export function runWithAgentTurnContext<T>(
  ctx: AgentTurnContextStore,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(
    {
      ...ctx,
      provenanceHits: [],
      billing: {
        agentRounds: 0,
        toolsUsed: [],
        semanticSearchCount: 0,
        ragTokens: 0,
        databaseRows: 0,
        capped: false,
      },
    },
    fn,
  );
}
