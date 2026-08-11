export interface UserRecord {
  id: string;
  google_id: string | null;
  username: string;
  email: string;
  first_name: string;
  profile_image: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  /** When set (anonymous visitors), insert with this primary key. */
  id?: string;
  google_id?: string | null;
  username: string;
  email: string;
  first_name: string;
  profile_image?: string;
  role?: string;
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
