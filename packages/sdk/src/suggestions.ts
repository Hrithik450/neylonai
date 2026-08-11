import { tryGetAuthHeaders } from "./client";
import { apiUrl } from "./network";
import { getOrCreateSessionId, getOrCreateVisitorId } from "./visitor";

export interface ProactiveSuggestionDto {
  id: string;
  text: string;
  source: "welcome" | "conversation" | "history" | "page" | "knowledge";
}

export interface FetchSuggestionsInput {
  pagePath?: string | null;
  pageUrl?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  mode?: "idle" | "post_chat";
  limit?: number;
  /** Already shown / dismissed ids for this visitor (demoted server-side). */
  excludeIds?: string[];
  visitorId?: string | null;
  sessionId?: string | null;
  signal?: AbortSignal;
}

export async function fetchSuggestions(
  input: FetchSuggestionsInput = {},
): Promise<{ success: boolean; data: ProactiveSuggestionDto[]; error?: string }> {
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
        recentMessages: input.recentMessages,
        mode: input.mode ?? "idle",
        limit: input.limit,
        excludeIds: input.excludeIds,
        visitorId,
        sessionId,
      }),
      signal: input.signal,
    });

    const json = (await response.json()) as {
      success?: boolean;
      data?: ProactiveSuggestionDto[];
      error?: string;
    };

    return {
      success: Boolean(json.success),
      data: Array.isArray(json.data) ? json.data : [],
      error: json.error,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "Failed to fetch suggestions",
    };
  }
}
