/** Wire-format types matching the Next.js API responses. Owned by the SDK so it has zero workspace deps. */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  profile_image: string | null;
  has_been_onboarded: boolean;
  onboarding_step: number;
}

export interface UserResponse {
  success: boolean;
  user?: User | null;
  error?: string | null;
  isNewUser?: boolean;
}

export interface Thread {
  id: string;
  user: string;
  title: string;
  escalated?: boolean;
  conversation_status?:
    | "ai_active"
    | "awaiting_contact"
    | "human_pending"
    | "human_active"
    | "resolved";
  created_at: string;
  in_reply_to_message_id?: string | null;
  page_path?: string | null;
  page_query?: Record<string, string>;
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
  /** Discard everything streamed so far this turn — a tool round preceded the answer. */
  | { event: "assistantReset"; data: "reset" }
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
      data: { escalated: boolean; status?: string; threadId?: string };
    }
  | {
      event: "handoffContactRequired";
      data: { escalated: false; status: "awaiting_contact"; threadId: string };
    }
  | {
      event: "messagePersisted";
      data: { userMessageId: string; assistantMessageId: string };
    }
  | { event: "done"; data: "end" }
  | {
      event: "error";
      data: {
        error: string;
        /** Server auth/usage code, e.g. `usage_exceeded`. */
        code?: string;
        /** Structured block reason when included credits are exhausted. */
        blocked?: "credits" | string;
        /** Optional upgrade CTA when Free/paid limits require a plan change. */
        upgrade?: {
          title?: string;
          detail?: string;
          ctaLabel?: string;
          href?: string;
          targetPlanId?: string;
        };
      };
    };

/** Structured credit-exhaustion payload returned by chat / billing APIs. */
export interface CreditExhaustionError {
  code: "usage_exceeded";
  blocked: "credits";
  error: string;
  upgrade?: {
    title?: string;
    detail?: string;
    ctaLabel?: string;
    href?: string;
    targetPlanId?: string;
  };
}
