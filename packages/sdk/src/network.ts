/**
 * Neylon AI API origin resolution.
 *
 * Customer embeds always hit production. Local first-party / same-host Next
 * serves orchestration on the page origin — use that so `pnpm dev` works.
 * Optional override: NEXT_PUBLIC_NEYLONAI_API_ORIGIN (first-party / ops only).
 */

const NEYLONAI_API_ORIGIN = "https://api.neylon.ai";

function envOrigin(): string | null {
  if (typeof process === "undefined") return null;
  const raw = process.env.NEXT_PUBLIC_NEYLONAI_API_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

/** Resolved backend origin for SDK fetches. */
export function getApiOrigin(): string {
  const fromEnv = envOrigin();
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) {
    return window.location.origin;
  }

  return NEYLONAI_API_ORIGIN;
}

/** Build an absolute URL against the Neylon AI backend. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiOrigin()}${normalized}`;
}
