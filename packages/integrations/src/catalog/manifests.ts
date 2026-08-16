/**
 * Single registry of customer-facing integration manifests.
 * Browser-safe: do not import server-only modules (pg or scrape providers).
 */

import type { IntegrationIngestKind, IntegrationManifest } from "./types";
import type { IntegrationModule } from "./module";
import { websiteManifest } from "../website/manifest";
import { databaseManifest } from "../database/manifest";
import { whatsappManifest } from "../whatsapp";
import { calcomManifest } from "../calcom";
import { webSearchManifest } from "../web-search";

/** Ordered catalog used by dashboard UI, APIs, and billing entitlement mapping. */
export const INTEGRATION_MANIFESTS: readonly IntegrationManifest[] = [
  websiteManifest,
  databaseManifest,
  webSearchManifest,
  whatsappManifest,
  calcomManifest,
] as const;

/** Manifest-only modules (safe for client). Ops live on per-integration imports. */
export const INTEGRATION_MODULES: readonly IntegrationModule[] =
  INTEGRATION_MANIFESTS.map((manifest) => ({ manifest }));

const byId = new Map(
  INTEGRATION_MANIFESTS.map((m) => [m.id, m] as const),
);

export function listIntegrationModules(): readonly IntegrationModule[] {
  return INTEGRATION_MODULES;
}

export function listIntegrationManifests(): readonly IntegrationManifest[] {
  return INTEGRATION_MANIFESTS;
}

export function getIntegrationManifest(
  id: string,
): IntegrationManifest | undefined {
  return byId.get(id);
}

export function getIntegrationModule(
  id: string,
): IntegrationModule | undefined {
  return INTEGRATION_MODULES.find((m) => m.manifest.id === id);
}

/** Implemented Import integrations (scrape/upload into org knowledge). */
export function isImportIntegration(id: string): boolean {
  const m = getIntegrationManifest(id);
  return Boolean(m && m.dataMode === "import" && m.connectable);
}

/** Implemented Connect integrations (on-demand, no permanent copy). */
export function isConnectIntegration(id: string): boolean {
  const m = getIntegrationManifest(id);
  return Boolean(m && m.dataMode === "connect" && m.connectable);
}

/** Implemented Sync integrations (bidirectional). None connectable yet. */
export function isSyncIntegration(id: string): boolean {
  const m = getIntegrationManifest(id);
  return Boolean(m && m.dataMode === "sync" && m.connectable);
}

/** How an Import integration brings data in (from manifest.ingestKind). */
export function getImportIngestKind(
  id: string,
): IntegrationIngestKind | null {
  const m = getIntegrationManifest(id);
  if (!m || m.dataMode !== "import") return null;
  return m.ingestKind ?? null;
}

/** Catalog ids that use the knowledge import pipeline when connectable. */
export function listImportIntegrationIds(options?: {
  connectableOnly?: boolean;
}): string[] {
  const connectableOnly = options?.connectableOnly !== false;
  return INTEGRATION_MANIFESTS.filter(
    (m) =>
      m.dataMode === "import" && (!connectableOnly || m.connectable),
  ).map((m) => m.id);
}

/** Slim billing entitlement rows derived from the same registry (no second list). */
export function toBillingCatalogEntry(m: IntegrationManifest): {
  id: string;
  name: string;
  description: string;
  planBadge: IntegrationManifest["planBadge"];
} {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    planBadge: m.planBadge,
  };
}

export function listBillingCatalogEntries() {
  return INTEGRATION_MANIFESTS.map(toBillingCatalogEntry);
}
