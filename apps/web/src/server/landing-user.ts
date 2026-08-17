import { getSessionFromCookies, type SessionUser } from "@/server/auth-cookies";
import { db, users } from "@neylonai/database";
import { eq } from "drizzle-orm";

/**
 * Get user with fresh onboarding data for landing page.
 * Landing page should only use SDK or internal web utilities, not domain packages.
 */
export async function getLandingUser(): Promise<SessionUser | null> {
  const sessionUser = await getSessionFromCookies();
  if (!sessionUser) return null;

  // Fetch fresh onboarding state from database
  const row = await db
    .select({
      has_been_onboarded: users.has_been_onboarded,
      onboarding_step: users.onboarding_step,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) return null;

  // Update session user with fresh onboarding data
  return {
    ...sessionUser,
    has_been_onboarded: row.has_been_onboarded,
    onboarding_step: row.onboarding_step ?? 0,
  };
}
