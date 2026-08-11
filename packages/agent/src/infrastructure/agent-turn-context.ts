import { AsyncLocalStorage } from "node:async_hooks";
import type { ProvenanceChunkHit } from "@neylonai/domain/knowledge";

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
  /** Accumulated RAG hits for this turn (dashboard provenance). */
  provenanceHits?: ProvenanceChunkHit[];
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
  const store: AgentTurnContextStore = { ...ctx, provenanceHits: [] };
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
  return storage.run({ ...ctx, provenanceHits: [] }, fn);
}
