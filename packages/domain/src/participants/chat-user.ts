/** Participant payload sent from the SDK on each chat turn. */
export type ChatUserPayload = {
  id: string;
  name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  anonymous?: boolean;
};

export function parseChatUserPayload(raw: unknown): ChatUserPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id || id.length > 255) return null;
  return {
    id,
    name: typeof o.name === "string" ? o.name : null,
    email: typeof o.email === "string" ? o.email : null,
    profile_image:
      typeof o.profile_image === "string" ? o.profile_image : null,
    anonymous: typeof o.anonymous === "boolean" ? o.anonymous : undefined,
  };
}
