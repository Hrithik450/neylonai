export interface UserRecord {
  id: string;
  google_id: string | null;
  username: string;
  email: string;
  first_name: string;
  profile_image: string | null;
  role: string;
  daily_limit: number;
  resume_generation_limit: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  google_id: string;
  username: string;
  email: string;
  first_name: string;
  profile_image?: string;
}

export interface UpdateUserInput {
  first_name?: string;
  profile_image?: string;
}

export interface UserResponse {
  success: boolean;
  data?: UserRecord;
  error?: string;
}
