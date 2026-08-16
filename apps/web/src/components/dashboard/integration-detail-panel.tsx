"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DatabaseConnectPanel } from "./integrations/database-connect-panel";
import { WebsiteCrawlPanel } from "./website-crawl-panel";

type IntegrationDetail = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  available: boolean;
  connectable: boolean;
  credentialsConfigured?: boolean;
  config: Record<string, unknown>;
  connectedAccount: string | null;
};

export function IntegrationDetailPanel({
  integrationId,
}: {
  integrationId: string;
}) {
  const [row, setRow] = useState<IntegrationDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectionUrl, setConnectionUrl] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/integrations/${integrationId}`);
    const json = (await response.json()) as {
      success: boolean;
      data?: { integration: IntegrationDetail };
      error?: string;
    };
    if (!json.success || !json.data) {
      throw new Error(json.error ?? "Failed to load integration.");
    }
    setRow(json.data.integration);
    const configuredMeetingUrl = json.data.integration.config.meetingUrl;
    if (typeof configuredMeetingUrl === "string")
      setMeetingUrl(configuredMeetingUrl);
  }, [integrationId]);

  useEffect(() => {
    void load().catch((reason: unknown) => {
      setError(
        reason instanceof Error
          ? reason.message
          : "Failed to load integration.",
      );
    });
  }, [load]);

  const update = async (enabled: boolean, config?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/integrations/${integrationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, config }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!json.success) throw new Error(json.error ?? "Update failed.");
      await load();
      setSuccess(
        enabled ? "Integration connected." : "Integration disconnected.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const disconnectKnowledge = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", integrationId }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: {
          deletedDocuments?: number;
          reimportAvailableAt?: string | null;
        };
      };
      if (!json.success) throw new Error(json.error ?? "Disconnect failed.");
      await load();
      const deleted = json.data?.deletedDocuments ?? 0;
      const availableAt = json.data?.reimportAvailableAt;
      setSuccess(
        `Disconnected. Deleted ${deleted.toLocaleString()} stored page${
          deleted === 1 ? "" : "s"
        }.${availableAt ? ` You can import again after ${new Date(availableAt).toLocaleString()}.` : ""}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  };

  const connectDatabase = async () => {
    if (!connectionUrl.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: "database",
          action: "connect_database",
          connectionUrl: connectionUrl.trim(),
          provider: "supabase",
          deployment: "cloud",
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { tableCount?: number };
      };
      if (!json.success)
        throw new Error(json.error ?? "Database connection failed.");
      setSuccess(
        `Database connected${json.data?.tableCount ? ` with ${json.data.tableCount} tables` : ""}.`,
      );
      setConnectionUrl("");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Database connection failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!row) {
    return <p className="text-sm">{error ?? "Loading integration…"}</p>;
  }

  const websiteUrl =
    typeof row.config.url === "string"
      ? row.config.url
      : (row.connectedAccount ?? "");
  const websiteReimportAvailableAt =
    typeof row.config.reimportAvailableAt === "string"
      ? row.config.reimportAvailableAt
      : null;

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/dashboard/integrations"
        className="caption text-xs hover:underline"
      >
        ← Integrations
      </Link>
      <div>
        <h1 className="text-3xl">{row.name}</h1>
        <p className="mt-1 text-sm text-[var(--ink)]/65">{row.description}</p>
      </div>

      <div className="rounded-xl border border-[var(--ink)]/15 bg-white p-5">
        {integrationId === "website" ? (
          <WebsiteCrawlPanel
            enabled={row.enabled}
            initialUrl={websiteUrl}
            reimportAvailableAt={websiteReimportAvailableAt}
            busy={busy}
            onDisconnected={disconnectKnowledge}
            onConnectionChanged={() => {
              void load().catch(() => undefined);
            }}
          />
        ) : integrationId === "database" ? (
          <DatabaseConnectPanel
            integrationId="database"
            enabled={row.enabled}
            credentialsConfigured={row.credentialsConfigured}
            busy={busy}
            error={error}
            success={success}
            connectionUrl={connectionUrl}
            onConnectionUrlChange={setConnectionUrl}
            onConnect={() => void connectDatabase()}
            onDisconnect={() => void disconnectKnowledge()}
          />
        ) : integrationId === "calcom" ? (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Public meeting URL</span>
              <input
                className="ink-input w-full"
                placeholder="https://cal.com/your-team/demo"
                value={meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-ink bg-[var(--ink)] px-4 py-2 text-sm text-white"
              disabled={busy || !meetingUrl.trim()}
              onClick={() =>
                void update(true, { meetingUrl: meetingUrl.trim() })
              }
            >
              Save and connect
            </button>
            {row.enabled ? (
              <button
                type="button"
                className="btn-ink ml-2 bg-white px-4 py-2 text-sm"
                disabled={busy}
                onClick={() => void update(false)}
              >
                Disconnect
              </button>
            ) : null}
          </div>
        ) : integrationId === "whatsapp" ? (
          <p className="text-sm">WhatsApp Business messaging is coming soon.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              {row.enabled
                ? "Web Search is available to your agent."
                : "Enable Web Search to let your agent answer time-sensitive questions."}
            </p>
            <button
              type="button"
              className="btn-ink bg-[var(--ink)] px-4 py-2 text-sm text-white"
              disabled={busy || !row.available}
              onClick={() => void update(!row.enabled)}
            >
              {row.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {success ? (
        <p className="text-sm text-[var(--green)]">{success}</p>
      ) : null}
    </section>
  );
}
