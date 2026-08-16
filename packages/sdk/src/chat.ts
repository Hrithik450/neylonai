import {
  isAbortError,
  parseEventStream,
  tryGetAuthHeaders,
} from "./client";
import { apiUrl } from "./network";
import type { AgentStreamEvent } from "./types";
import type { TrackedPageSection } from "./page-context";

/** Participant sent on each chat turn (host user or anonymous widget visitor). */
export type StreamChatUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  anonymous?: boolean;
};

export interface StreamChatInput {
  input: string;
  user: StreamChatUser;
  threadId?: string | null;
  /** Current page metadata only; page body content is never sent. */
  pagePath?: string | null;
  pageQuery?: Record<string, string>;
  pageSection?: TrackedPageSection | null;
  /** When aborted, fetch and stream parsing stop; callers should treat as cancel, not error. */
  signal?: AbortSignal;
}

/**
 * Streams a chat turn from the orchestration endpoint.
 * Yields typed AgentStreamEvent objects as they arrive.
 * Re-throws AbortError when `signal` is aborted so callers can distinguish cancel vs failure.
 */
export async function* streamChat(
  payload: StreamChatInput,
): AsyncGenerator<AgentStreamEvent> {
  const auth = tryGetAuthHeaders({ "Content-Type": "application/json" });
  if ("error" in auth) {
    yield {
      event: "error",
      data: { error: auth.error },
    };
    return;
  }

  let response: Response;

  try {
    response = await fetch(apiUrl("/orchestration/api/v1/chat"), {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({
        input: payload.input,
        user: payload.user,
        threadId: payload.threadId,
        pagePath: payload.pagePath,
        pageQuery: payload.pageQuery,
        pageSection: payload.pageSection,
      }),
      signal: payload.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    yield {
      event: "error",
      data: {
        error: error instanceof Error ? error.message : "Network error",
      },
    };
    return;
  }

  if (!response.ok) {
    let message = `Chat request failed (${response.status})`;
    let code: string | undefined;
    let blocked: string | undefined;
    let upgrade:
      | {
          title?: string;
          detail?: string;
          ctaLabel?: string;
          href?: string;
          targetPlanId?: string;
        }
      | undefined;
    try {
      const json = (await response.json()) as {
        error?: string;
        code?: string;
        blocked?: string;
        upgrade?: {
          title?: string;
          detail?: string;
          ctaLabel?: string;
          href?: string;
          targetPlanId?: string;
        };
        details?: {
          blocked?: string;
          upgrade?: {
            title?: string;
            detail?: string;
            ctaLabel?: string;
            href?: string;
            targetPlanId?: string;
          };
        };
      };
      if (json.error) message = json.error;
      code = json.code;
      blocked = json.blocked ?? json.details?.blocked;
      upgrade = json.upgrade ?? json.details?.upgrade;
      if (response.status === 402 && !code) {
        code = "usage_exceeded";
      }
      if (response.status === 402 && !blocked) {
        blocked = "credits";
      }
    } catch {
      // ignore
    }
    yield {
      event: "error",
      data: {
        error: message,
        ...(code ? { code } : {}),
        ...(blocked ? { blocked } : {}),
        ...(upgrade ? { upgrade } : {}),
      },
    };
    return;
  }

  if (!response.body) {
    yield { event: "error", data: { error: "Empty response body" } };
    return;
  }

  for await (const event of parseEventStream(response.body, payload.signal)) {
    yield event as AgentStreamEvent;
  }
}
