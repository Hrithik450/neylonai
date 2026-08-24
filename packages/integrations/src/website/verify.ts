/**
 * Pre-crawl URL gate: only syntactically valid, DNS-resolvable, publicly
 * routable HTTPS sites are accepted. Runs before any job is created so a bad
 * address fails in the form instead of halfway through a crawl.
 */

import { lookup } from "node:dns/promises";
import { isBlockedIpLiteral } from "../database/constants";
import { assertSafePublicHttpUrl, originOf } from "./urls";

const REACHABILITY_TIMEOUT_MS = 12_000;
const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export class WebsiteUrlError extends Error {
  readonly code: WebsiteUrlErrorCode;
  constructor(code: WebsiteUrlErrorCode, message: string) {
    super(message);
    this.name = "WebsiteUrlError";
    this.code = code;
  }
}

export type WebsiteUrlErrorCode =
  | "invalid_url"
  | "insecure_url"
  | "dns_not_found"
  | "private_address"
  | "unreachable";

export type VerifiedWebsiteUrl = {
  url: string;
  origin: string;
  hostname: string;
  redirectedTo: string | null;
};

function isLocalHostname(candidate: string): boolean {
  let host: string;
  try {
    host = new URL(candidate).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isBlockedIpLiteral(host)
  );
}

/**
 * Parses user input into an https URL without touching the network.
 * Bare hosts (`acme.com`) and `http://` input are upgraded to https; the
 * caller still has to prove the https endpoint answers.
 */
export function normalizeWebsiteInputUrl(raw: string): URL {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    throw new WebsiteUrlError("invalid_url", "Enter your website address.");
  }
  if (/\s/.test(trimmed)) {
    throw new WebsiteUrlError(
      "invalid_url",
      "That website address contains spaces. Enter a single URL like https://acme.com.",
    );
  }

  const scheme = trimmed
    .match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]
    ?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    throw new WebsiteUrlError(
      "invalid_url",
      "Only website addresses starting with https:// can be imported.",
    );
  }

  const candidate = scheme ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = assertSafePublicHttpUrl(candidate);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enter a valid website address.";
    throw new WebsiteUrlError(
      isLocalHostname(candidate) ? "private_address" : "invalid_url",
      message,
    );
  }

  if (!HOSTNAME_RE.test(parsed.hostname)) {
    throw new WebsiteUrlError(
      "invalid_url",
      `"${parsed.hostname}" is not a valid domain name.`,
    );
  }

  // Credentials in the URL are stripped; they would leak into stored config.
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  parsed.protocol = "https:";
  return parsed;
}

async function assertResolvable(hostname: string): Promise<void> {
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new WebsiteUrlError(
      "dns_not_found",
      `We couldn't find "${hostname}". Check the spelling of your website address.`,
    );
  }
  if (addresses.length === 0) {
    throw new WebsiteUrlError(
      "dns_not_found",
      `We couldn't find "${hostname}". Check the spelling of your website address.`,
    );
  }
  if (addresses.every((entry) => isBlockedIpLiteral(entry.address))) {
    throw new WebsiteUrlError(
      "private_address",
      `"${hostname}" resolves to a private address, so it can't be imported.`,
    );
  }
}

async function probe(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop, { once: true });
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "NeylonAI-Scraper/1.0 (+https://neylonai.mhrithik.com)",
      },
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

export async function verifyWebsiteUrl(
  raw: string,
  options?: { signal?: AbortSignal },
): Promise<VerifiedWebsiteUrl> {
  const parsed = normalizeWebsiteInputUrl(raw);
  await assertResolvable(parsed.hostname);

  let response: Response;
  try {
    response = await probe(parsed.toString(), options?.signal);
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/certificate|self-signed|altnames|SSL|TLS/i.test(message)) {
      throw new WebsiteUrlError(
        "insecure_url",
        `"${parsed.hostname}" has an invalid security certificate, so it can't be imported.`,
      );
    }
    throw new WebsiteUrlError(
      "insecure_url",
      `"${parsed.hostname}" doesn't support a secure https connection. Enable https on your site, then try again.`,
    );
  }

  const finalUrl = new URL(response.url || parsed.toString());
  if (finalUrl.protocol !== "https:") {
    throw new WebsiteUrlError(
      "insecure_url",
      `"${parsed.hostname}" redirects to an insecure http address, so it can't be imported.`,
    );
  }
  try {
    assertSafePublicHttpUrl(finalUrl.toString());
  } catch {
    throw new WebsiteUrlError(
      "private_address",
      `"${parsed.hostname}" redirects to a private address, so it can't be imported.`,
    );
  }
  if (response.status === 404 || response.status === 410) {
    throw new WebsiteUrlError(
      "unreachable",
      `That page doesn't exist on "${parsed.hostname}" (${response.status}). Check the address and try again.`,
    );
  }
  if (response.status >= 500) {
    throw new WebsiteUrlError(
      "unreachable",
      `"${parsed.hostname}" returned a server error (${response.status}). Try again once the site is back up.`,
    );
  }

  const redirected = finalUrl.toString() !== parsed.toString();
  return {
    url: redirected ? finalUrl.toString() : parsed.toString(),
    origin: originOf(redirected ? finalUrl : parsed),
    hostname: (redirected ? finalUrl : parsed).hostname,
    redirectedTo: redirected ? finalUrl.toString() : null,
  };
}
