import { SessionUser } from "@/store/session-store";

export interface SessionResponse {
  success: boolean;
  data: { user: SessionUser } | null;
  error: string | null;
}
