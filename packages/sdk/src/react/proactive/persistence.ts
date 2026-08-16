import type { ProactiveSuggestionDto } from "../..";
import { PROACTIVE_CONFIG } from "./config";
import { getOrCreateVisitorId } from "../../visitor";

export interface PageVisitProgress {
  knownSectionKeys: string[];
  shownSectionKeys: string[];
  visitComplete: boolean;
}

/** Counts how many suggestions have been shown per section scope ("path:sectionId"). */
export type SectionShownCounts = Record<string, number>;

export interface ProactivePersistedState {
  visitorId: string;
  shownIds: string[];
  welcomeShown: boolean;
  initialSuggestionCount: number;
  sessionBatchId: string | null;
  sessionSuggestionCount: number;
  shownSectionKeys: string[];
  /** How many suggestions shown per section scope ("pagePath:sectionId"). */
  sectionShownCounts: SectionShownCounts;
  visitProgressByPath: Record<string, PageVisitProgress>;
  pool: ProactiveSuggestionDto[];
  poolPagePath: string | null;
  poolSectionKey: string | null;
  poolMode: "idle" | "post_chat" | null;
  poolFetchedAt: number;
}

const EMPTY = (visitorId: string): ProactivePersistedState => ({
  visitorId,
  shownIds: [],
  welcomeShown: false,
  initialSuggestionCount: 0,
  sessionBatchId: null,
  sessionSuggestionCount: 0,
  shownSectionKeys: [],
  sectionShownCounts: {},
  visitProgressByPath: {},
  pool: [],
  poolPagePath: null,
  poolSectionKey: null,
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
    const raw = localStorage.getItem(storageKey(visitorId));
    if (!raw) return EMPTY(visitorId);
    const parsed = JSON.parse(raw) as Partial<ProactivePersistedState>;
    if (parsed.visitorId && parsed.visitorId !== visitorId) {
      return EMPTY(visitorId);
    }
    return {
      visitorId,
      shownIds: Array.isArray(parsed.shownIds)
        ? parsed.shownIds.filter((id): id is string => typeof id === "string")
        : [],
      welcomeShown:
        parsed.welcomeShown === true ||
        (Array.isArray(parsed.shownIds) && parsed.shownIds.includes("welcome")),
      initialSuggestionCount:
        typeof parsed.initialSuggestionCount === "number"
          ? Math.min(Math.max(parsed.initialSuggestionCount, 0), 2)
          : 0,
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
      shownSectionKeys: Array.isArray(parsed.shownSectionKeys)
        ? parsed.shownSectionKeys.filter(
            (key): key is string => typeof key === "string",
          )
        : [],
      sectionShownCounts:
        parsed.sectionShownCounts &&
        typeof parsed.sectionShownCounts === "object" &&
        !Array.isArray(parsed.sectionShownCounts)
          ? Object.fromEntries(
              Object.entries(parsed.sectionShownCounts).filter(
                ([, v]) => typeof v === "number",
              ) as [string, number][],
            )
          : {},
      visitProgressByPath:
        parsed.visitProgressByPath &&
        typeof parsed.visitProgressByPath === "object"
          ? Object.fromEntries(
              Object.entries(parsed.visitProgressByPath).flatMap(
                ([path, progress]) => {
                  if (!progress || typeof progress !== "object") return [];
                  const p = progress as Partial<PageVisitProgress>;
                  return [
                    [
                      path,
                      {
                        knownSectionKeys: Array.isArray(p.knownSectionKeys)
                          ? p.knownSectionKeys.filter(
                              (k): k is string => typeof k === "string",
                            )
                          : [],
                        shownSectionKeys: Array.isArray(p.shownSectionKeys)
                          ? p.shownSectionKeys.filter(
                              (k): k is string => typeof k === "string",
                            )
                          : [],
                        visitComplete: p.visitComplete === true,
                      },
                    ],
                  ];
                },
              ),
            )
          : {},
      pool: Array.isArray(parsed.pool) ? parsed.pool.slice(0, 12) : [],
      poolPagePath:
        typeof parsed.poolPagePath === "string" ? parsed.poolPagePath : null,
      poolSectionKey:
        typeof parsed.poolSectionKey === "string" ? parsed.poolSectionKey : null,
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

function sectionScopeKey(pagePath: string, sectionId: string): string {
  return `${pagePath}:${sectionId}`;
}

export function markSectionSuggestionShown(
  state: ProactivePersistedState,
  pagePath: string,
  sectionId: string,
  knownSectionKeys: string[],
  /** Total suggestions available for this section in the current pool. */
  sectionPoolSize: number,
): ProactivePersistedState {
  const path = pagePath.trim() || "/";
  const scope = sectionScopeKey(path, sectionId);

  // Increment the per-section shown count.
  const prevCount = state.sectionShownCounts[scope] ?? 0;
  const newCount = prevCount + 1;
  const sectionShownCounts = { ...state.sectionShownCounts, [scope]: newCount };

  // Only mark the section as fully done when all pool suggestions are exhausted.
  const sectionExhausted = newCount >= sectionPoolSize;
  const shownSectionKeys =
    sectionExhausted && !state.shownSectionKeys.includes(scope)
      ? [...state.shownSectionKeys, scope]
      : state.shownSectionKeys;

  const progress = state.visitProgressByPath[path] ?? {
    knownSectionKeys: [],
    shownSectionKeys: [],
    visitComplete: false,
  };
  const known =
    knownSectionKeys.length > 0
      ? [...new Set(knownSectionKeys)]
      : progress.knownSectionKeys;
  const pathShown =
    sectionExhausted && !progress.shownSectionKeys.includes(sectionId)
      ? [...progress.shownSectionKeys, sectionId]
      : progress.shownSectionKeys;
  const visitComplete =
    known.length > 0 && known.every((key) => pathShown.includes(key));

  return {
    ...state,
    shownSectionKeys,
    sectionShownCounts,
    visitProgressByPath: {
      ...state.visitProgressByPath,
      [path]: {
        knownSectionKeys: known,
        shownSectionKeys: pathShown,
        visitComplete,
      },
    },
  };
}

/** True once every registered section on this path has received a dwell seed. */
export function isPageVisitComplete(
  state: ProactivePersistedState,
  pagePath: string,
  knownSectionKeys: string[],
): boolean {
  const path = pagePath.trim() || "/";
  const progress = state.visitProgressByPath[path];
  if (progress?.visitComplete) return true;
  const known = knownSectionKeys.length
    ? knownSectionKeys
    : (progress?.knownSectionKeys ?? []);
  if (!known.length) return false;
  const shown =
    progress?.shownSectionKeys ??
    state.shownSectionKeys
      .filter((key) => key.startsWith(`${path}:`))
      .map((key) => key.slice(path.length + 1));
  return known.every((key) => shown.includes(key));
}

export function unshownSectionKeysForPath(
  state: ProactivePersistedState,
  pagePath: string,
  knownSectionKeys: string[],
): string[] {
  const path = pagePath.trim() || "/";
  const known = knownSectionKeys.length
    ? knownSectionKeys
    : (state.visitProgressByPath[path]?.knownSectionKeys ?? []);
  const shown =
    state.visitProgressByPath[path]?.shownSectionKeys ??
    state.shownSectionKeys
      .filter((key) => key.startsWith(`${path}:`))
      .map((key) => key.slice(path.length + 1));
  return known.filter((key) => !shown.includes(key));
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

  // First bubble for this visitor is always the welcome.
  if (options?.preferWelcome) {
    const welcome = pool.find(
      (s) => s.source === "welcome" && !state.shownIds.includes(s.id),
    );
    if (welcome) return welcome;
  }

  const candidates = pool.filter(
    (s) => s.source !== "welcome" && !state.shownIds.includes(s.id),
  );
  if (!candidates.length) return null;

  const ranked = [...candidates].sort((a, b) => {
    const sourceBoost = (s: ProactiveSuggestionDto) => {
      switch (s.source) {
        case "recent_conversation":
          return 40;
        case "conversation_history":
          return 25;
        case "section":
          return 20;
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
    return sourceBoost(b) + pageBoost(b) - (sourceBoost(a) + pageBoost(a));
  });

  return ranked[0] ?? null;
}
