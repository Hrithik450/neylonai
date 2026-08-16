export type IntegrationPlanBadge = "free" | "starter" | "pro" | "business";

export type IntegrationDataMode = "import" | "connect" | "sync";

export const INTEGRATION_DATA_MODE_LABELS: Record<IntegrationDataMode, string> =
  {
    import: "Import",
    connect: "Connect",
    sync: "Sync",
  };

export type IntegrationIngestKind = "scrape" | "upload" | "oauth" | "schema";

export type IntegrationUiState =
  | "connected"
  | "needs_attention"
  | "disconnected"
  | "available"
  | "locked"
  | "coming_soon";

export interface IntegrationManifest {
  id: string;
  name: string;
  description: string;
  dataMode: IntegrationDataMode;
  /** false = coming soon; enable is blocked. */
  connectable: boolean;
  /** Minimum plan required to enable. */
  planBadge: IntegrationPlanBadge;
  logoUrl?: string;
  /** Import only. */
  ingestKind?: IntegrationIngestKind;
  /**
   * Keys that must never appear in config / API responses.
   * Stored in organization_integration_secrets (connectionUrl, OAuth tokens, …).
   */
  credentialKeys?: readonly string[];
  stubNote?: string;
}

export interface IntegrationConnectionSnapshot {
  /** True when the org has enabled this integration. */
  enabled: boolean;
  /** True when an organization_integrations row exists. */
  installed?: boolean;
  available: boolean;
  connectable?: boolean;
  config?: Record<string, unknown> | null;
}

export function integrationLogoLetters(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  const compact = name.replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(0, 2) || "??").toUpperCase();
}

export function resolveIntegrationUiState(
  snap: IntegrationConnectionSnapshot,
): IntegrationUiState {
  if (snap.connectable === false && !snap.enabled) return "coming_soon";
  if (!snap.available && !snap.enabled) return "locked";
  if (snap.enabled) return "connected";
  if (snap.installed) return "disconnected";
  return "available";
}

export function connectedAccountLabel(
  config: Record<string, unknown> | null | undefined,
): string | null {
  if (!config) return null;
  const keys = [
    "accountLabel",
    "account",
    "email",
    "workspace",
    "team",
    "url",
    "fileName",
  ] as const;
  for (const k of keys) {
    const v = config[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function lastSyncLabel(
  config: Record<string, unknown> | null | undefined,
): string | null {
  if (!config) return null;
  const raw = config.lastSyncAt ?? config.last_sync_at ?? config.syncedAt;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString();
}

/**
 * Strip credential keys from config for API responses.
 * Callers set `credentialsConfigured` from the vault separately.
 */
export function redactIntegrationConfig(
  config: Record<string, unknown> | null | undefined,
  credentialKeys: readonly string[] | undefined,
): Record<string, unknown> {
  const base = { ...(config ?? {}) };
  if (!credentialKeys?.length) return base;
  for (const key of credentialKeys) {
    delete base[key];
  }
  return base;
}

