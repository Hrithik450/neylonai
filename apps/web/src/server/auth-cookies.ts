import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  verifySession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type SessionUser,
} from "@neylonai/auth/session";

export type { SessionUser };

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" keeps the cookie on the top-level navigation that follows login.
    // WebKit historically mishandles "none", and this cookie is first-party.
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  };
}

/** Sets the session cookie via Next.js cookies() API. */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSession(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

/**
 * Writes the session cookie onto a response the handler already built. Route
 * handlers that construct their own `NextResponse` must not rely on the
 * implicit `cookies()` merge — attaching the header directly guarantees the
 * browser sees `Set-Cookie` on the login response itself.
 */
export async function attachSessionCookie<T extends NextResponse>(
  response: T,
  user: SessionUser,
): Promise<T> {
  const token = await createSession(user);
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getSessionFromRequest(
  req: NextRequest,
): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
