/**
 * Session helpers are safe for Next.js middleware / Edge.
 * Identity providers (Google) pull Node-only deps — import `@neylonai/auth/identity`.
 */
export {
  createSession,
  verifySession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type SessionUser,
} from "./session";
