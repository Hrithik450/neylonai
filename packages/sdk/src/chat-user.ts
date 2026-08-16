/**
 * Build the participant payload for chat API from widget config user + anon fallback.
 */
export function buildStreamChatUser(input: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  anonymousVisitorId: string;
}): {
  id: string;
  name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  anonymous: boolean;
} {
  const externalId = input.id?.trim() || input.anonymousVisitorId;
  const hasAccount = Boolean(input.id?.trim());
  return {
    id: externalId,
    name: input.name ?? null,
    email: input.email ?? null,
    profile_image: input.profile_image ?? null,
    anonymous: !hasAccount,
  };
}
