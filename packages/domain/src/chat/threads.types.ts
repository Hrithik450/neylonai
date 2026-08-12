export interface Thread {
  id: string;
  user: string;
  title: string;
  created_at: string;
}

export interface CreateThreadInput {
  /** Widget visitor id (stored as threads.visitor_id). */
  user_id: string;
  title: string;
}

export interface UpdateThreadInput {
  title?: string;
}

export interface ThreadResponse {
  success: boolean;
  data?: Thread;
  error?: string;
}

export interface ThreadsResponse {
  success: boolean;
  data?: Thread[];
  error?: string;
}
