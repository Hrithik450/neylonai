export interface ThreadMessage {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  /** Agent that authored this assistant turn (null for user/human). */
  agent_id?: string | null;
  /** Dashboard fields (e.g. provenance, agent_name). Omit / strip for public widget. */
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateThreadMessageInput {
  thread_id: string;
  role: string;
  content: string;
  agent_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ThreadMessageResponse {
  success: boolean;
  data?: ThreadMessage;
  error?: string;
}

export interface ThreadMessagesResponse {
  success: boolean;
  data?: ThreadMessage[];
  error?: string;
}
