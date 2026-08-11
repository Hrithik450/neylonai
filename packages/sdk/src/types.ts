/** Wire-format types matching the Next.js API responses. Owned by the SDK so it has zero workspace deps. */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  profile_image: string | null;
}

export interface UserResponse {
  success: boolean;
  user?: User | null;
  error?: string | null;
}

export interface Thread {
  id: string;
  user: string;
  title: string;
  created_at: string;
}

export interface ThreadResponse {
  success: boolean;
  data?: Thread | null;
  error?: string | null;
}

export interface ThreadsResponse {
  success: boolean;
  data?: Thread[] | null;
  error?: string | null;
}

export interface ThreadMessage {
  id: string;
  thread_id?: string;
  thread?: string;
  role: string;
  content: string;
  created_at: string;
  file_url?: string;
}

export interface ThreadMessageResponse {
  success: boolean;
  data?: ThreadMessage | null;
  error?: string | null;
}

export interface ThreadMessagesResponse {
  success: boolean;
  data?: ThreadMessage[] | null;
  error?: string | null;
}

export type AgentStreamEvent =
  | { event: "threadCreated"; data: Thread }
  | { event: "assistantResponse"; data: string }
  | {
      event: "thinkingTips";
      data: {
        tips: string[];
        source?: "heuristic" | "llm";
        thinking?: string;
      };
    }
  | {
      event: "conversationEscalated";
      data: { reference: string; status: string };
    }
  | { event: "done"; data: "end" }
  | { event: "error"; data: { error: string } };
