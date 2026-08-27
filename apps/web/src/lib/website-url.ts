/**
 * Isomorphic website-address validation shared by the Integrations crawl panel
 * and the onboarding wizard. Mirrors the server gate so obvious typos fail
 * before a request is sent. Pure and dependency-free — safe to import from
 * either a client component or server code.
 */

/** A hostname is 1–253 chars: dot-separated labels with a 2–63 letter TLD. */
export const DOMAIN_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Returns a human-readable problem with `raw`, or null when it's acceptable. */
export function websiteUrlIssue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) {
    return "Website address can’t contain spaces.";
  }
  const scheme = trimmed
    .match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]
    ?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    return "Only https:// website addresses can be imported.";
  }
  let parsed: URL;
  try {
    parsed = new URL(scheme ? trimmed : `https://${trimmed}`);
  } catch {
    return "Enter a valid website address, like https://acme.com.";
  }
  if (!DOMAIN_RE.test(parsed.hostname)) {
    return `“${parsed.hostname}” is not a valid domain name.`;
  }
  return null;
}
