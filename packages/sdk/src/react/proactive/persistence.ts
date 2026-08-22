import type { ProactiveSuggestionDto } from "../..";
import { PROACTIVE_CONFIG } from "./config";
import { getOrCreateVisitorId } from "../../visitor";
import {
  EMPTY_SUGGESTION_QUEUE,
  parseSuggestionQueue,
  type SuggestionQueue,
} from "./suggestion-queue";

export interface ProactivePersistedState {
  visitorId: string;
  shownIds: string[];
  /** True after the visitor has seen their first welcome bubble. */
  hasVisitedBefore: boolean;
  sessionBatchId: string | null;
  sessionSuggestionCount: number;
  /** Path the current queue was seeded for (cleared on navigation). */
  queuePagePath: string | null;
  /** Conversation fingerprint already used for context-based suggestions. */
  lastConsumedContextFingerprint: string | null;
  suggestionQueue: SuggestionQueue;
}

const EMPTY = (visitorId: string): ProactivePersistedState => ({
  visitorId,
  shownIds: [],
  hasVisitedBefore: false,
  sessionBatchId: null,
  sessionSuggestionCount: 0,
  queuePagePath: null,
  lastConsumedContextFingerprint: null,
  suggestionQueue: { ...EMPTY_SUGGESTION_QUEUE },
});

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function storageKey(visitorId: string): string {
  return `${PROACTIVE_CONFIG.storageKey}.${visitorId}`;
}

export function loadProactiveState(): ProactivePersistedState {
  const visitorId = getOrCreateVisitorId();
  if (!canUseStorage()) return EMPTY(visitorId);
  try {
    const raw = localStorage.getItem(storageKey(visitorId));
    if (!raw) return EMPTY(visitorId);
    const parsed = JSON.parse(raw) as Partial<ProactivePersistedState> & {
      welcomeShown?: boolean;
    };
    if (parsed.visitorId && parsed.visitorId !== visitorId) {
      return EMPTY(visitorId);
    }
    return {
      visitorId,
      shownIds: Array.isArray(parsed.shownIds)
        ? parsed.shownIds.filter((id): id is string => typeof id === "string")
        : [],
      hasVisitedBefore:
        parsed.hasVisitedBefore === true ||
        parsed.welcomeShown === true ||
        (Array.isArray(parsed.shownIds) &&
          (parsed.shownIds.includes("welcome") ||
            parsed.shownIds.includes("welcome-back"))),
      sessionBatchId:
        typeof parsed.sessionBatchId === "string"
          ? parsed.sessionBatchId
          : null,
      sessionSuggestionCount:
        typeof parsed.sessionSuggestionCount === "number"
          ? Math.min(
              Math.max(parsed.sessionSuggestionCount, 0),
              PROACTIVE_CONFIG.sessionSuggestionLimit,
            )
          : 0,
      queuePagePath:
        typeof parsed.queuePagePath === "string" ? parsed.queuePagePath : null,
      lastConsumedContextFingerprint:
        typeof parsed.lastConsumedContextFingerprint === "string"
          ? parsed.lastConsumedContextFingerprint
          : null,
      suggestionQueue: parseSuggestionQueue(parsed.suggestionQueue),
    };
  } catch {
    return EMPTY(visitorId);
  }
}

const claimedSessionBatches = new Set<string>();

/**
 * Claims the batch for this tab session. The in-memory claim survives SPA
 * remounts, and a reload re-enters the same session, so the claim is granted
 * again while the session still has unshown prompts left in its budget.
 */
export function claimProactiveSessionBatch(
  sessionId: string,
  budgetRemaining: number,
): boolean {
  if (claimedSessionBatches.has(sessionId)) return true;
  if (typeof sessionStorage === "undefined") {
    claimedSessionBatches.add(sessionId);
    return true;
  }
  const key = `${PROACTIVE_CONFIG.storageKey}.session.${sessionId}`;
  try {
    if (sessionStorage.getItem(key) && budgetRemaining <= 0) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode: best effort for this document.
  }
  claimedSessionBatches.add(sessionId);
  return true;
}

export function saveProactiveState(state: ProactivePersistedState): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(storageKey(state.visitorId), JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function countsTowardSessionLimit(
  source: ProactiveSuggestionDto["source"],
): boolean {
  return (
    source !== "welcome" &&
    source !== "welcome_back" &&
    source !== "recent_conversation"
  );
}
