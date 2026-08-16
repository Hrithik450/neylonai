export interface ThreadMessage {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  in_reply_to_message_id: string | null;
  page_path: string | null;
  page_query: Record<string, string>;
  created_at: string;
}

export interface CreateThreadMessageInput {
  id?: string;
  thread_id: string;
  role: string;
  content: string;
  in_reply_to_message_id?: string | null;
  page_path?: string | null;
  page_query?: Record<string, string>;
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
