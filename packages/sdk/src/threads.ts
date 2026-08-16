import { tryGetAuthHeaders } from "./client";
import { apiUrl } from "./network";
import type { ThreadsResponse, ThreadMessagesResponse } from "./types";

export async function listThreads(userId: string): Promise<ThreadsResponse> {
  const auth = tryGetAuthHeaders();
  if ("error" in auth) {
    return { success: false, data: null, error: auth.error };
  }

  try {
    const response = await fetch(apiUrl(`/api/v1/threads/user/${userId}`), {
      credentials: "include",
      headers: auth.headers,
    });
    return (await response.json()) as ThreadsResponse;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to list threads",
    };
  }
}

export async function listMessages(
  threadId: string,
  visitorId: string,
): Promise<ThreadMessagesResponse> {
  const auth = tryGetAuthHeaders();
  if ("error" in auth) {
    return { success: false, data: null, error: auth.error };
  }

  try {
    const response = await fetch(
      apiUrl(
        `/api/v1/thread_messages/${threadId}?visitorId=${encodeURIComponent(visitorId)}`,
      ),
      {
        credentials: "include",
        headers: auth.headers,
      },
    );
    return (await response.json()) as ThreadMessagesResponse;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to list messages",
    };
  }
}
