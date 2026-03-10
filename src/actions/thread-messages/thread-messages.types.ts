export interface ThreadMessage {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface CreateThreadMessageInput {
  thread_id: string;
  role: string;
  content: string;
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
