import type { ProactiveSuggestionDto } from "../..";
import { PROACTIVE_CONFIG } from "./config";
import { getOrCreateSessionId, getOrCreateVisitorId } from "../../visitor";
import {
  EMPTY_SUGGESTION_QUEUE,
  parseSuggestionQueue,
  type SuggestionQueue,
} from "./suggestion-queue";

export interface ProactivePersistedState {
  visitorId: string;
  sessionId: string;
  /** Visitor-durable: suggestion ids already delivered (localStorage). */
  shownIds: string[];
  /** True after the visitor has seen their first welcome bubble. */
  hasVisitedBefore: boolean;
  /** Conversation fingerprint already used for an on-demand suggestion. */
  lastConsumedContextFingerprint: string | null;
  /** Session-scoped: capped bubbles already delivered this session. */
  sessionSuggestionCount: number;
  /**
   * Session-scoped: a completed support-widget interaction has earned an
   * on-demand bubble that has not been delivered yet.
   */
  pendingOnDemand: boolean;
  /** Path the current queue was seeded for (cleared on navigation). */
  queuePagePath: string | null;
  suggestionQueue: SuggestionQueue;
}

/** Visitor-durable half — survives tab close, shared across tabs. */
interface VisitorState {
  shownIds: string[];
  hasVisitedBefore: boolean;
  lastConsumedContextFingerprint: string | null;
}

/** Session half — survives reload of this tab, dies with the tab. */
interface SessionState {
  sessionSuggestionCount: number;
  pendingOnDemand: boolean;
  queuePagePath: string | null;
  suggestionQueue: SuggestionQueue;
}

const EMPTY_VISITOR: VisitorState = {
  shownIds: [],
  hasVisitedBefore: false,
  lastConsumedContextFingerprint: null,
};

const EMPTY_SESSION: SessionState = {
  sessionSuggestionCount: 0,
  pendingOnDemand: false,
  queuePagePath: null,
  suggestionQueue: { ...EMPTY_SUGGESTION_QUEUE },
};

function canUseStorage(kind: "local" | "session"): boolean {
  if (typeof window === "undefined") return false;
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__neylonai_proactive_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function visitorKey(visitorId: string): string {
  return `${PROACTIVE_CONFIG.storageKey}.${visitorId}`;
}

function sessionKey(sessionId: string): string {
  return `${PROACTIVE_CONFIG.storageKey}.s.${sessionId}`;
}

function readVisitorState(visitorId: string): VisitorState {
  if (!canUseStorage("local")) return { ...EMPTY_VISITOR };
  try {
    const raw = localStorage.getItem(visitorKey(visitorId));
    if (!raw) return { ...EMPTY_VISITOR };
    const parsed = JSON.parse(raw) as Partial<ProactivePersistedState> & {
      welcomeShown?: boolean;
    };
    if (parsed.visitorId && parsed.visitorId !== visitorId) {
      return { ...EMPTY_VISITOR };
    }
    const shownIds = Array.isArray(parsed.shownIds)
      ? parsed.shownIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      shownIds: shownIds.slice(-120),
      hasVisitedBefore:
        parsed.hasVisitedBefore === true ||
        parsed.welcomeShown === true ||
        shownIds.includes("welcome") ||
        shownIds.includes("welcome-back"),
      lastConsumedContextFingerprint:
        typeof parsed.lastConsumedContextFingerprint === "string"
          ? parsed.lastConsumedContextFingerprint
          : null,
    };
  } catch {
    return { ...EMPTY_VISITOR };
  }
}

function readSessionState(sessionId: string): {
  state: SessionState;
  isNewSession: boolean;
} {
  if (!canUseStorage("session")) {
    return { state: { ...EMPTY_SESSION }, isNewSession: true };
  }
  try {
    const raw = sessionStorage.getItem(sessionKey(sessionId));
    if (!raw) return { state: { ...EMPTY_SESSION }, isNewSession: true };
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (!parsed || typeof parsed !== "object") {
      return { state: { ...EMPTY_SESSION }, isNewSession: true };
    }
    return {
      state: {
        sessionSuggestionCount:
          typeof parsed.sessionSuggestionCount === "number"
            ? Math.min(
                Math.max(Math.trunc(parsed.sessionSuggestionCount), 0),
                PROACTIVE_CONFIG.sessionSuggestionLimit,
              )
            : 0,
        pendingOnDemand: parsed.pendingOnDemand === true,
        queuePagePath:
          typeof parsed.queuePagePath === "string" ? parsed.queuePagePath : null,
        suggestionQueue: parseSuggestionQueue(parsed.suggestionQueue),
      },
      isNewSession: false,
    };
  } catch {
    return { state: { ...EMPTY_SESSION }, isNewSession: true };
  }
}

/**
 * "Is this a new session?" is decided once per page load, so SPA remounts and
 * React strict-mode double mounts don't lose the welcome-back greeting.
 */
let newSessionVerdict: { sessionId: string; isNewSession: boolean } | null = null;

/**
 * Loads proactive state for this visitor + tab session.
 *
 * The session budget lives in sessionStorage, so a reload re-enters the same
 * session with the same remaining budget, while a brand-new tab starts fresh.
 */
export function loadProactiveState(): {
  state: ProactivePersistedState;
  isNewSession: boolean;
} {
  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const visitor = readVisitorState(visitorId);
  const { state: session, isNewSession } = readSessionState(sessionId);

  if (newSessionVerdict?.sessionId !== sessionId) {
    newSessionVerdict = { sessionId, isNewSession };
  }

  return {
    state: { visitorId, sessionId, ...visitor, ...session },
    isNewSession: newSessionVerdict.isNewSession,
  };
}

export function saveProactiveState(state: ProactivePersistedState): void {
  if (canUseStorage("local")) {
    try {
      localStorage.setItem(
        visitorKey(state.visitorId),
        JSON.stringify({
          visitorId: state.visitorId,
          shownIds: state.shownIds.slice(-120),
          hasVisitedBefore: state.hasVisitedBefore,
          lastConsumedContextFingerprint: state.lastConsumedContextFingerprint,
        } satisfies VisitorState & { visitorId: string }),
      );
    } catch {
      // Quota / private mode — ignore.
    }
  }

  if (canUseStorage("session")) {
    try {
      sessionStorage.setItem(
        sessionKey(state.sessionId),
        JSON.stringify({
          sessionSuggestionCount: state.sessionSuggestionCount,
          pendingOnDemand: state.pendingOnDemand,
          queuePagePath: state.queuePagePath,
          suggestionQueue: state.suggestionQueue,
        } satisfies SessionState),
      );
    } catch {
      // Quota / private mode — ignore.
    }
  }
}

/**
 * On-demand bubbles are the reward for a completed support-widget interaction
 * and are unlimited; every other bubble spends the session budget.
 */
export function countsTowardSessionLimit(
  source: ProactiveSuggestionDto["source"],
): boolean {
  return source !== "recent_conversation";
}

export function sessionBudgetRemaining(
  state: Pick<ProactivePersistedState, "sessionSuggestionCount">,
): number {
  return Math.max(
    0,
    PROACTIVE_CONFIG.sessionSuggestionLimit - state.sessionSuggestionCount,
  );
}
