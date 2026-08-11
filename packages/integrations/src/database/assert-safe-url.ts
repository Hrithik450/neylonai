/**
 * Server-only Postgres URL safety (DNS resolution + private IP block).
 */

import { lookup } from "dns/promises";
import {
  assertHostnameNotBlocked,
  assertPostgresConnectionUrl,
  isBlockedIpLiteral,
} from "./constants";

/**
 * Validate protocol/format, block private hostnames, and resolve DNS to
 * ensure the target is not a private/link-local address.
 */
export async function assertSafePostgresConnectionUrl(
  raw: string,
): Promise<string> {
  const connectionUrl = assertPostgresConnectionUrl(raw);
  const hostname = new URL(connectionUrl).hostname.replace(/^\[|\]$/g, "");
  assertHostnameNotBlocked(hostname);

  // Literal IPs already checked in assertHostnameNotBlocked.
  if (isBlockedIpLiteral(hostname) || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return connectionUrl;
  }
  if (hostname.includes(":")) {
    return connectionUrl;
  }

  try {
    const results = await lookup(hostname, { all: true, verbatim: true });
    for (const r of results) {
      if (isBlockedIpLiteral(r.address)) {
        throw new Error(
          "Database host resolves to a private or link-local address, which is not allowed.",
        );
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("private or link-local")
    ) {
      throw error;
    }
    throw new Error(
      "Could not resolve database host. Check the hostname and try again.",
    );
  }

  return connectionUrl;
}
