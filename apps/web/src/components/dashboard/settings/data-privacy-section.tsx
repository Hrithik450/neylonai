"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrganizationSettings } from "@neylonai/sdk";
import {
  FieldHint,
  FieldLabel,
  SettingsButton,
  SettingsSectionFrame,
} from "./settings-ui";

export function DataPrivacySettingsSection() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/organization-settings");
    const json = (await res.json()) as {
      success: boolean;
      data?: { settings: OrganizationSettings };
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
      const res = await fetch("/api/v1/organization-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacy: settings.privacy }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: OrganizationSettings };
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

  if (!settings) {
    return <p className="caption text-sm">{message ?? "Loading…"}</p>;
  }

  const p = settings.privacy;

  return (
    <SettingsSectionFrame
      title="Data & Privacy"
      description="Retention controls for this organization."
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
            How long conversation history is kept for this organization.
            Enforcement jobs apply this policy over time.
          </FieldHint>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <SettingsButton disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save privacy settings"}
          </SettingsButton>
        </div>
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </SettingsSectionFrame>
  );
}
