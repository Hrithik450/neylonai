import { and, eq } from "drizzle-orm";
import { db, organizationIntegrations } from "@neylonai/database";
import {
  getSecret,
  putSecret,
  stripCredentialKeysFromConfig,
} from "./vault";

export const DATABASE_CONNECTION_URL_SECRET_KEY = "connectionUrl";

/**
 * Resolve the customer Postgres URL for the database integration.
 * Prefers the vault; lazily migrates legacy plaintext config.connectionUrl.
 */
export async function resolveDatabaseConnectionUrl(
  organizationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      id: organizationIntegrations.id,
      enabled: organizationIntegrations.enabled,
      config: organizationIntegrations.config,
    })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, organizationId),
        eq(organizationIntegrations.integration_type, "database"),
      ),
    )
    .limit(1);

  if (!row?.enabled) return null;

  const fromVault = await getSecret({
    organizationIntegrationId: row.id,
    secretKey: DATABASE_CONNECTION_URL_SECRET_KEY,
  });
  if (fromVault?.trim()) return fromVault.trim();

  const cfg = (row.config ?? {}) as Record<string, unknown>;
  const legacy =
    typeof cfg.connectionUrl === "string" ? cfg.connectionUrl.trim() : "";
  if (!legacy) return null;

  // Lazy migrate plaintext → vault
  await putSecret({
    organizationId,
    organizationIntegrationId: row.id,
    secretKey: DATABASE_CONNECTION_URL_SECRET_KEY,
    plaintext: legacy,
  });
  await db
    .update(organizationIntegrations)
    .set({
      config: stripCredentialKeysFromConfig(cfg, [
        DATABASE_CONNECTION_URL_SECRET_KEY,
      ]),
      updated_at: new Date(),
    })
    .where(eq(organizationIntegrations.id, row.id));

  return legacy;
}
