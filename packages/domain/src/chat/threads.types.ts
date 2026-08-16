export interface Thread {
  id: string;
  /** Participant external id (host user id or anonymous uuid) for SDK compat. */
  user: string;
  title: string;
  /** When true, AI must not reply; human follow-up is expected. */
  escalated: boolean;
  conversation_status:
    | "ai_active"
    | "awaiting_contact"
    | "human_pending"
    | "human_active"
    | "resolved";
  created_at: string;
}

export interface CreateThreadInput {
  organization_id: string;
  participant_id: string;
  title: string;
}

export interface UpdateThreadInput {
  title?: string;
  conversation_status?: Thread["conversation_status"];
  escalated?: boolean;
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
