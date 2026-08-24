import { tryGetAuthHeaders } from "./client";
import { apiUrl } from "./network";
import type { StreamChatUser } from "./chat";

async function jsonRequest<T>(
  path: string,
  init: RequestInit,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const auth = tryGetAuthHeaders({ "Content-Type": "application/json" });
  if ("error" in auth) return { success: false, error: auth.error };
  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers: { ...auth.headers, ...(init.headers ?? {}) },
    });
    return (await response.json()) as {
      success: boolean;
      data?: T;
      error?: string;
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export function requestHumanHandoff(input: {
  threadId?: string | null;
  user: StreamChatUser;
  name?: string;
  email?: string;
  /** The one contact the visitor chose — any of email / phone / linkedin. */
  contact?: { type: "email" | "phone" | "linkedin"; value: string };
  reason?: string;
}) {
  return jsonRequest<{
    threadId: string;
    escalated: boolean;
    contactRequired?: boolean;
    status: string;
    customerMessage: string;
  }>("/api/v1/conversations/handoff", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function submitMessageFeedback(input: {
  messageId: string;
  visitorId: string;
  helpful: boolean;
  comment?: string | null;
}) {
  return jsonRequest<{ helpful: boolean; comment: string | null }>(
    "/api/v1/messages/feedback",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getLatestHumanReply(visitorId: string): Promise<{
  success: boolean;
  data?: {
    messageId: string;
    threadId: string;
    threadTitle: string;
    content: string;
    createdAt: string;
  } | null;
  error?: string;
}> {
  const auth = tryGetAuthHeaders();
  if ("error" in auth) {
    return Promise.resolve({
      success: false as const,
      error: auth.error,
    });
  }
  return fetch(
    apiUrl(
      `/api/v1/conversations/human-replies/latest?visitorId=${encodeURIComponent(visitorId)}`,
    ),
    { credentials: "include", headers: auth.headers },
  )
    .then(
      (response) =>
        response.json() as Promise<{
          success: boolean;
          data?: {
            messageId: string;
            threadId: string;
            threadTitle: string;
            content: string;
            createdAt: string;
          } | null;
          error?: string;
        }>,
    )
    .catch((error: unknown) => ({
      success: false,
      error: error instanceof Error ? error.message : "Request failed",
    }));
}
