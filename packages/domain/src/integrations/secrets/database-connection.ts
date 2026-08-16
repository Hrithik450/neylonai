import { and, eq } from "drizzle-orm";
import { db, organizationIntegrations } from "@neylonai/database";
import { getSecret } from "./vault";

export const DATABASE_CONNECTION_URL_SECRET_KEY = "connectionUrl";

/** Resolve the customer Postgres URL from the secrets vault. */
export async function resolveDatabaseConnectionUrl(
  organizationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      id: organizationIntegrations.id,
      enabled: organizationIntegrations.enabled,
    })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, organizationId),
        eq(organizationIntegrations.integration_id, "database"),
      ),
    )
    .limit(1);

  if (!row?.enabled) return null;

  const fromVault = await getSecret({
    organizationIntegrationId: row.id,
    secretKey: DATABASE_CONNECTION_URL_SECRET_KEY,
  });
  return fromVault?.trim() || null;
}
