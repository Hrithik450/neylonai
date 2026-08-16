export interface UserRecord {
  id: string;
  google_id: string | null;
  username: string;
  email: string;
  profile_image: string | null;
  role: string;
  has_been_onboarded: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  /** When set (anonymous visitors), insert with this primary key. */
  id?: string;
  google_id?: string | null;
  username: string;
  email: string;
  profile_image?: string;
  role?: string;
}

export interface UpdateUserInput {
  username?: string;
  profile_image?: string;
  has_been_onboarded?: boolean;
  onboarding_step?: number;
}

export interface UserResponse {
  success: boolean;
  data?: UserRecord;
  error?: string;
}
