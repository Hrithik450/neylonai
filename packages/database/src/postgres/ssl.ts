/**
 * SSL for `pg` Pool — controlled by env so the same code works for
 * local Docker Postgres (no SSL) and cloud providers (SSL required).
 *
 * - DATABASE_SSL=true|false  → explicit override
 * - otherwise: no SSL for localhost / docker service hostnames; SSL elsewhere
 */
export function getPostgresSsl(
  connectionString: string,
): false | { rejectUnauthorized: boolean } {
  const explicit = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (explicit === "false" || explicit === "0" || explicit === "off") {
    return false;
  }
  if (explicit === "true" || explicit === "1" || explicit === "on") {
    return { rejectUnauthorized: false };
  }

  try {
    const host = new URL(connectionString).hostname;
    const localHosts = new Set([
      "localhost",
      "127.0.0.1",
      "::1",
      "postgres",
      "host.docker.internal",
    ]);
    if (localHosts.has(host)) return false;
  } catch {
    // Fall through to SSL on — safer default for unknown / cloud URLs.
  }

  return { rejectUnauthorized: false };
}
