"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrganizationSettings } from "@neylonai/domain/workspace";
import {
  FieldHint,
  FieldLabel,
  SettingsButton,
  SettingsSectionFrame,
} from "./settings-ui";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function GeneralSettingsSection() {
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
        body: JSON.stringify({
          organizationName: settings.organizationName,
          timezone: settings.timezone,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: OrganizationSettings };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Save failed");
      setSettings(json.data.settings);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return <p className="caption text-sm">{message ?? "Loading…"}</p>;
  }

  return (
    <SettingsSectionFrame
      title="General"
      description="Organization identity and timezone."
    >
      <section className="ink-card p-6 space-y-5">
        <label className="block space-y-1.5">
          <FieldLabel>Organization name</FieldLabel>
          <input
            className="ink-input"
            value={settings.organizationName}
            onChange={(e) =>
              setSettings({ ...settings, organizationName: e.target.value })
            }
          />
          <FieldHint>Internal name for your organization.</FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Timezone</FieldLabel>
          <select
            className="ink-input py-2"
            value={settings.timezone}
            onChange={(e) =>
              setSettings({ ...settings, timezone: e.target.value })
            }
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <FieldHint>
            Used for timestamps across your organization.
          </FieldHint>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <SettingsButton disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save general settings"}
          </SettingsButton>
          {message ? <span className="caption text-sm">{message}</span> : null}
        </div>
      </section>
    </SettingsSectionFrame>
  );
}
