import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "neylonai-session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const JWT_EXPIRY = "7d";
const rawSecret =
  process.env.AUTH_SECRET || process.env.JWT_SECRET;

if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET / JWT_SECRET must be set in production.");
}

const JWT_SECRET = new TextEncoder().encode(
  rawSecret || "dev-only-secret-not-for-production",
);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  profile_image: string | null;
  has_been_onboarded: boolean;
  onboarding_step: number;
}

/** Signs a short-lived JWT embedding the session user. Pure — no cookie/framework access. */
export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

/** Verifies a session JWT and returns the embedded user, or null if invalid/expired. */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload as { user: SessionUser }).user;
  } catch {
    return null;
  }
}
