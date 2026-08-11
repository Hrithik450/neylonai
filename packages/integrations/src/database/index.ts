/**
 * Database integration — Postgres read-only schema import for LLM / SQL tools.
 * Server-only: importing this module pulls in `pg`.
 */

import type { IntegrationModule } from "../catalog/module";
import { introspectPostgresSchema } from "./introspect";
import { assertSafePostgresConnectionUrl } from "./assert-safe-url";
import {
  assertPostgresConnectionUrl,
  POSTGRES_READONLY_SETUP_SQL,
} from "./constants";
import { databaseManifest } from "./manifest";

export {
  assertPostgresConnectionUrl,
  POSTGRES_READONLY_SETUP_SQL,
} from "./constants";
export { assertSafePostgresConnectionUrl } from "./assert-safe-url";
export { databaseManifest } from "./manifest";

export type DatabaseConnectResult = {
  host: string;
  database: string;
  schemaText: string;
  tableCount: number;
  connectedAt: string;
};

/**
 * Connect with the provided URL, introspect information_schema, return
 * an LLM-friendly schema document.
 */
export async function connectPostgresForImport(
  connectionUrlInput: string,
): Promise<DatabaseConnectResult> {
  const connectionUrl =
    await assertSafePostgresConnectionUrl(connectionUrlInput);
  const result = await introspectPostgresSchema(connectionUrl);
  return {
    ...result,
    connectedAt: new Date().toISOString(),
  };
}

export const databaseIntegration = {
  manifest: databaseManifest,
  setupSql: POSTGRES_READONLY_SETUP_SQL,
  connectForImport: connectPostgresForImport,
} as const satisfies IntegrationModule & {
  setupSql: string;
  connectForImport: typeof connectPostgresForImport;
};
