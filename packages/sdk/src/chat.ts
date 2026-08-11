import {
  isAbortError,
  parseEventStream,
  tryGetAuthHeaders,
} from "./client";
import { apiUrl } from "./network";
import type { AgentStreamEvent } from "./types";

export interface StreamChatInput {
  input: string;
  senderId?: string;
  threadId?: string | null;
  /** Prior turns already on screen — used if server history is empty. */
  conversationHistory?: Array<{ role: string; content: string }>;
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
        senderId: payload.senderId,
        threadId: payload.threadId,
        conversationHistory: payload.conversationHistory,
      }),
      signal: payload.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    yield {
      event: "error",
      data: {
        error: "An unexpected error occurred. Please try again.",
      },
    };
    return;
  }

  if (!response.ok || !response.body) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    yield {
      event: "error",
      data: {
        error:
          errorData.error ??
          (response.status === 402
            ? "Subscription inactive. Chatbot is unavailable."
            : "An unexpected error occurred. Please try again."),
      },
    };
    return;
  }

  yield* parseEventStream<AgentStreamEvent>(response.body, payload.signal);
}
