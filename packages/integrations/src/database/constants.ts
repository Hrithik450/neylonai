/**
 * Browser-safe database integration constants (no `pg` / Node deps).
 * Host SSRF checks that need DNS live in `assert-safe-url.ts` (server-only).
 */

export const POSTGRES_READONLY_SETUP_SQL = `CREATE ROLE neylon_readonly LOGIN PASSWORD 'strong-password';

GRANT CONNECT ON DATABASE mydb TO neylon_readonly;
GRANT USAGE ON SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neylon_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO neylon_readonly;`;

export function assertPostgresConnectionUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Postgres connection URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      "Enter a valid Postgres URL (postgresql://user:pass@host:5432/db).",
    );
  }
  if (
    parsed.protocol !== "postgres:" &&
    parsed.protocol !== "postgresql:"
  ) {
    throw new Error("Only postgresql:// connection URLs are supported.");
  }
  if (!parsed.hostname) {
    throw new Error("Connection URL must include a host.");
  }
  assertHostnameNotBlocked(parsed.hostname);
  return trimmed;
}

/** Sync hostname / literal-IP checks (no DNS). */
export function assertHostnameNotBlocked(hostname: string): void {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) throw new Error("Connection URL must include a host.");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error(
      "Local or internal hostnames cannot be used for Database connections.",
    );
  }

  if (isBlockedIpLiteral(host)) {
    throw new Error(
      "Private, loopback, or link-local addresses cannot be used for Database connections.",
    );
  }
}

export function isBlockedIpLiteral(host: string): boolean {
  // IPv4
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const octets = v4.slice(1).map((p) => Number(p));
    if (octets.some((n) => n > 255)) return true;
    const [a, b] = octets as [number, number, number, number];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // IPv6 (simplified)
  if (host.includes(":")) {
    const h = host.toLowerCase();
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA fc00::/7
    if (h.startsWith("fe80")) return true; // link-local
    if (h.startsWith("::ffff:")) {
      const mapped = h.slice("::ffff:".length);
      if (isBlockedIpLiteral(mapped)) return true;
    }
  }

  return false;
}
