"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSettings } from "@neylonai/domain/workspace/types";
import {
  FieldHint,
  FieldLabel,
  SettingsSectionFrame,
} from "./settings-ui";

export function DataPrivacySettingsSection() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/workspace-settings");
    const json = (await res.json()) as {
      success: boolean;
      data?: { settings: WorkspaceSettings };
      error?: string;
    };
    if (json.success && json.data) setSettings(json.data.settings);
    else setMessage(json.error ?? "Failed to load");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/workspace-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacy: settings.privacy }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: WorkspaceSettings };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Save failed");
      setSettings(json.data.settings);
      setMessage("Privacy preferences saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const requestExport = () => {
    setMessage(
      "Export request recorded. We’ll prepare a workspace export for your Owner — automated download ships in a later release.",
    );
  };

  const requestDelete = () => {
    if (
      !confirm(
        "Request deletion of customer/workspace data? This is irreversible once processed. Continue?",
      )
    ) {
      return;
    }
    setMessage(
      "Deletion request noted for Owner review. Contact support to complete workspace deletion.",
    );
  };

  if (!settings) {
    return <p className="caption text-sm">{message ?? "Loading…"}</p>;
  }

  const p = settings.privacy;

  return (
    <SettingsSectionFrame
      title="Data & Privacy"
      description="Retention and privacy controls for this workspace. Conversation handling stays in Conversations; analytics stay in Evently."
    >
      <section className="ink-card p-6 space-y-5">
        <label className="block space-y-1.5">
          <FieldLabel>Conversation retention (days)</FieldLabel>
          <input
            className="ink-input"
            type="number"
            min={30}
            max={3650}
            value={p.conversationRetentionDays ?? 365}
            onChange={(e) =>
              setSettings({
                ...settings,
                privacy: {
                  ...p,
                  conversationRetentionDays: Number(e.target.value) || null,
                },
              })
            }
          />
          <FieldHint>
            How long conversation history is kept for this workspace. Enforcement
            jobs apply this policy over time.
          </FieldHint>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={p.allowDataExport}
            onChange={(e) =>
              setSettings({
                ...settings,
                privacy: { ...p, allowDataExport: e.target.checked },
              })
            }
          />
          <span>
            <span className="font-medium block">Allow data export</span>
            <span className="caption text-xs">
              Owners/Admins can request an export of workspace data.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={p.anonymizeVisitorIds}
            onChange={(e) =>
              setSettings({
                ...settings,
                privacy: { ...p, anonymizeVisitorIds: e.target.checked },
              })
            }
          />
          <span>
            <span className="font-medium block">Anonymize visitor identifiers</span>
            <span className="caption text-xs">
              Prefer hashed visitor IDs in exports and logs where possible.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ink"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save privacy settings"}
          </button>
        </div>
      </section>

      <section className="ink-card p-6 space-y-4">
        <h3 className="text-lg font-medium">Export & delete</h3>
        <p className="caption text-sm">
          Export packages conversations and leads for this workspace.
          Deletion removes customer data after Owner confirmation.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-ink bg-white"
            disabled={!p.allowDataExport}
            onClick={requestExport}
          >
            Request data export
          </button>
          <button
            type="button"
            className="btn-ink bg-white"
            onClick={requestDelete}
          >
            Request data deletion
          </button>
        </div>
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </SettingsSectionFrame>
  );
}
