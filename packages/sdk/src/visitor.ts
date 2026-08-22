/**
 * Durable anonymous visitor id for unauthenticated widget users.
 *
 * One id per browser profile (shared across tabs/windows of that profile).
 * Persisted in localStorage + a long-lived first-party cookie so clears of
 * one store can still recover from the other. Not a secret — identity only.
 */
const VISITOR_KEY = "neylonai.visitorId.v1";
const SESSION_KEY = "neylonai.sessionId.v1";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 10; // 10 years

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryVisitorId: string | null = null;
let memorySessionId: string | null = null;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function randomUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback when crypto.randomUUID is unavailable.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function canUseStorage(kind: "local" | "session"): boolean {
  if (typeof window === "undefined") return false;

  try {
    const store =
      kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__neylonai_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const parts = document.cookie.split("; ");
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      if (part.slice(0, eq) !== name) continue;
      return decodeURIComponent(part.slice(eq + 1));
    }
  } catch {
    // ignore
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  try {
    const secure =
      typeof location !== "undefined" && location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

function readLocalVisitor(): string | null {
  if (!canUseStorage("local")) return null;
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    return isUuid(existing) ? existing.trim() : null;
  } catch {
    return null;
  }
}

function writeLocalVisitor(id: string): void {
  if (!canUseStorage("local")) return;
  try {
    localStorage.setItem(VISITOR_KEY, id);
  } catch {
    // ignore
  }
}

function persistVisitorId(id: string): void {
  memoryVisitorId = id;
  writeLocalVisitor(id);
  writeCookie(VISITOR_KEY, id);
}

/**
 * Stable anonymous id for this browser profile.
 * Prefer authenticated `user.id` when calling chat APIs — use this only as fallback.
 */
export function getOrCreateVisitorId(): string {
  if (isUuid(memoryVisitorId)) return memoryVisitorId;

  const fromLocal = readLocalVisitor();
  const fromCookie = readCookie(VISITOR_KEY);
  const recovered = isUuid(fromLocal)
    ? fromLocal
    : isUuid(fromCookie)
      ? fromCookie.trim()
      : null;

  if (recovered) {
    persistVisitorId(recovered);
    return recovered;
  }

  const id = randomUuid();
  persistVisitorId(id);
  return id;
}

/**
 * User id for chat ownership: signed-in user when present, otherwise durable anon id.
 */
export function getChatParticipantId(
  authenticatedUserId?: string | null,
): string {
  if (isUuid(authenticatedUserId)) return authenticatedUserId.trim();
  return getOrCreateVisitorId();
}

/** Stable for the current tab session (sessionStorage). */
export function getOrCreateSessionId(): string {
  if (memorySessionId) return memorySessionId;

  if (!canUseStorage("session")) {
    memorySessionId = randomUuid();
    return memorySessionId;
  }
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (isUuid(existing)) {
      memorySessionId = existing;
      return existing;
    }

    const id = randomUuid();
    sessionStorage.setItem(SESSION_KEY, id);
    memorySessionId = id;
    return id;
  } catch {
    memorySessionId = randomUuid();
    return memorySessionId;
  }
}
