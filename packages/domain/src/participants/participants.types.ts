export type ParticipantInput = {
  externalId: string;
  name?: string | null;
  email?: string | null;
  profileImage?: string | null;
  anonymous?: boolean;
};

export type ParticipantRecord = {
  id: string;
  organization_id: string;
  external_id: string;
  display_name: string;
  email: string | null;
  profile_image: string | null;
  is_anonymous: boolean;
  traits: Record<string, unknown>;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ParticipantResponse = {
  success: boolean;
  data?: ParticipantRecord;
  error?: string;
};
