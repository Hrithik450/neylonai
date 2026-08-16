import { assertPublicHttpUrl } from "../internal/scrape";
import {
  assertHostnameNotBlocked,
  isBlockedIpLiteral,
} from "../database/constants";

export const MAX_DISCOVERED_URLS = 25_000;

export function assertSafePublicHttpUrl(raw: string): URL {
  const parsed = assertPublicHttpUrl(raw);
  assertHostnameNotBlocked(parsed.hostname);
  if (isBlockedIpLiteral(parsed.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error("Private or loopback addresses cannot be fetched.");
  }
  return parsed;
}

export function registrableHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

export function sameSiteHost(a: string, b: string): boolean {
  return registrableHost(a) === registrableHost(b);
}

export function normalizePageUrl(raw: string, base?: string): URL | null {
  try {
    const parsed = base ? new URL(raw, base) : new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.hash = "";
    parsed.username = "";
    parsed.password = "";
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }
    const tracking = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "mc_cid",
      "mc_eid",
    ];
    for (const key of tracking) parsed.searchParams.delete(key);
    parsed.searchParams.sort();
    return parsed;
  } catch {
    return null;
  }
}

export function canonicalPathOf(url: URL): string {
  return url.pathname.replace(/\/+$/, "") || "/";
}

export function originOf(url: URL): string {
  return `${url.protocol}//${url.host}`;
}
