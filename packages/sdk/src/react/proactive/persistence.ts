import type { ProactiveSuggestionDto } from "../..";
import { PROACTIVE_CONFIG } from "./config";
import { getOrCreateVisitorId } from "../../visitor";

export interface ProactivePersistedState {
  visitorId: string;
  /** Recently shown suggestion ids (rotation memory). */
  shownIds: string[];
  /** Cached suggestion pool — scoped to visitor + page + mode. */
  pool: ProactiveSuggestionDto[];
  poolPagePath: string | null;
  poolMode: "idle" | "post_chat" | null;
  poolFetchedAt: number;
}

const EMPTY = (visitorId: string): ProactivePersistedState => ({
  visitorId,
  shownIds: [],
  pool: [],
  poolPagePath: null,
  poolMode: null,
  poolFetchedAt: 0,
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
    // Drop legacy caches (global / non-visitor-scoped).
    localStorage.removeItem("neylonai.proactiveSuggestions.v1");
    localStorage.removeItem("neylonai.proactiveSuggestions.v3");
    localStorage.removeItem("neylonai.proactiveSuggestions.v4");
    localStorage.removeItem("neylonai.proactiveSuggestions.v5");

    const raw = localStorage.getItem(storageKey(visitorId));
    if (!raw) return EMPTY(visitorId);
    const parsed = JSON.parse(raw) as Partial<ProactivePersistedState>;
    if (parsed.visitorId && parsed.visitorId !== visitorId) {
      return EMPTY(visitorId);
    }
    return {
      visitorId,
      shownIds: Array.isArray(parsed.shownIds) ? parsed.shownIds.slice(-40) : [],
      pool: Array.isArray(parsed.pool) ? parsed.pool.slice(0, 8) : [],
      poolPagePath:
        typeof parsed.poolPagePath === "string" ? parsed.poolPagePath : null,
      poolMode:
        parsed.poolMode === "post_chat" || parsed.poolMode === "idle"
          ? parsed.poolMode
          : null,
      poolFetchedAt:
        typeof parsed.poolFetchedAt === "number" ? parsed.poolFetchedAt : 0,
    };
  } catch {
    return EMPTY(visitorId);
  }
}

export function saveProactiveState(state: ProactivePersistedState): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(storageKey(state.visitorId), JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function pickNextSuggestion(
  pool: ProactiveSuggestionDto[],
  state: ProactivePersistedState,
  pagePath: string | null,
  options?: { preferWelcome?: boolean },
): ProactiveSuggestionDto | null {
  if (!pool.length) return null;

  const tokens = (pagePath ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);

  // First bubble of a session is always the welcome.
  if (options?.preferWelcome) {
    const welcome = pool.find((s) => s.source === "welcome");
    if (welcome) return welcome;
  }

  const candidates = pool.filter(
    (s) =>
      s.source !== "welcome" && !state.shownIds.slice(-6).includes(s.id),
  );
  const list =
    candidates.length > 0
      ? candidates
      : pool.filter((s) => s.source !== "welcome");
  if (!list.length) {
    return pool[0] ?? null;
  }

  const ranked = [...list].sort((a, b) => {
    const sourceBoost = (s: ProactiveSuggestionDto) => {
      switch (s.source) {
        case "conversation":
          return 40;
        case "history":
          return 25;
        case "page":
          return 15;
        default:
          return 0;
      }
    };
    const pageBoost = (s: ProactiveSuggestionDto) => {
      const hay = s.text.toLowerCase();
      return tokens.reduce((n, t) => n + (hay.includes(t) ? 3 : 0), 0);
    };
    const freshPenalty = (s: ProactiveSuggestionDto) =>
      state.shownIds.includes(s.id) ? -8 : 0;

    return (
      sourceBoost(b) +
      pageBoost(b) +
      freshPenalty(b) -
      (sourceBoost(a) + pageBoost(a) + freshPenalty(a))
    );
  });

  return ranked[0] ?? null;
}
