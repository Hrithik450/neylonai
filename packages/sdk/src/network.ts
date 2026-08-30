/**
 * Neylon AI API origin resolution.
 *
 * Customer embeds always hit production. Local first-party / same-host Next
 * serves orchestration on the page origin — use that so `pnpm dev` works.
 * Optional override: NEXT_PUBLIC_NEYLONAI_API_ORIGIN (first-party / ops only).
 */

const NEYLONAI_API_ORIGIN = "https://neylonai.mhrithik.com";

function envOrigin(): string | null {
  if (typeof process === "undefined") return null;
  const raw = process.env.NEXT_PUBLIC_NEYLONAI_API_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function getScriptOrigin(): string | null {
  if (typeof document === "undefined") return null;
  // If embedded via <script data-key="...">, infer API origin from the script's src URL
  const script = document.querySelector("script[data-key]") as HTMLScriptElement;
  if (script && script.src) {
  try {
      const url = new URL(script.src);
      // Optional: ignore if script somehow loaded from another host, but typically it's correct
      return url.origin;
    } catch {
      return null;
    }
  }
 return null;
}

/** Resolved backend origin for SDK fetches. */
export function getApiOrigin(): string {
 const fromEnv = envOrigin();
  if (fromEnv) return fromEnv;

 const scriptOrigin = getScriptOrigin();
  if (scriptOrigin) return scriptOrigin;

  return NEYLONAI_API_ORIGIN;
}

/** Build an absolute URL against the Neylon AI backend. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiOrigin()}${normalized}`;
}