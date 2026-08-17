import type { SessionUser } from "@/server/auth-cookies";

/**
 * Maps the app's session user into the shape Neylon AI's widget expects.
 * Returns null for unauthenticated / anonymous visitors — the widget
 * handles anonymous sessions automatically.
 */
export function toNeylonUser(
  sessionUser: SessionUser | null | undefined,
): { id: string; name: string; email: string; profile_image?: string } | null {
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    profile_image: sessionUser.profile_image ?? undefined,
  };
}
