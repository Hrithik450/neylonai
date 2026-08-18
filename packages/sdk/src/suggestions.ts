import { apiUrl } from "./network";
import { tryGetAuthHeaders } from "./client";
import { getOrCreateSessionId, getOrCreateVisitorId } from "./visitor";
import type { TrackedPageSection } from "./page-context";

export interface ProactiveSuggestionDto {
  id: string;
  text: string;
  source:
    | "welcome"
    | "recent_conversation"
    | "conversation_history"
    | "section"
    | "page"
    | "knowledge";
  /** Stable page-section key when the suggestion is grounded in visible content. */
  contextKey?: string;
}

export interface FetchSuggestionsInput {
  pagePath?: string | null;
  pageUrl?: string | null;
  pageSection?: TrackedPageSection | null;
  recentMessages?: Array<{ role: string; content: string }>;
  mode?: "idle" | "post_chat";
  limit?: number;
  /** Already shown / dismissed ids for this visitor (demoted server-side). */
  excludeIds?: string[];
  /** Section keys not yet shown on this page (return-visit personalization). */
  unshownSectionKeys?: string[];
  /** Behavioral trigger that fired this refresh (constrained enum). */
  triggerType?: "idle" | "dwell";
  visitorId?: string | null;
  sessionId?: string | null;
  signal?: AbortSignal;
}

export interface ProactiveSectionStateDto {
  sectionKey: string;
  total: number;
  shown: number;
  pending: number;
}

export async function fetchSuggestions(
  input: FetchSuggestionsInput = {},
): Promise<{
  success: boolean;
  data: ProactiveSuggestionDto[];
  sectionState?: ProactiveSectionStateDto | null;
  error?: string;
}> {
  const auth = tryGetAuthHeaders({ "Content-Type": "application/json" });
  if ("error" in auth) {
    return { success: false, data: [], error: auth.error };
  }

  const visitorId = input.visitorId ?? getOrCreateVisitorId();
  const sessionId = input.sessionId ?? getOrCreateSessionId();

  try {
    const response = await fetch(apiUrl("/orchestration/api/v1/suggestions"), {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({
        pagePath: input.pagePath,
        pageUrl:
          input.pageUrl ??
          (typeof window !== "undefined" ? window.location.href : undefined),
        pageSection: input.pageSection,
        recentMessages: input.recentMessages,
        mode: input.mode ?? "idle",
        limit: input.limit,
        excludeIds: input.excludeIds,
        unshownSectionKeys: input.unshownSectionKeys,
        triggerType: input.triggerType,
        visitorId,
        sessionId,
      }),
      signal: input.signal,
    });

    const json = (await response.json()) as {
      success?: boolean;
      data?: ProactiveSuggestionDto[];
      sectionState?: ProactiveSectionStateDto | null;
      error?: string;
    };

    return {
      success: Boolean(json.success),
      data: Array.isArray(json.data) ? json.data : [],
      sectionState: json.sectionState ?? null,
      error: json.error,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error:
        error instanceof Error ? error.message : "Failed to fetch suggestions",
    };
  }
}
