"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSettings } from "@neylonai/domain/workspace/types";
import {
  FieldHint,
  FieldLabel,
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

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "hi", label: "Hindi" },
];

export function GeneralSettingsSection() {
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
        body: JSON.stringify({
          organizationName: settings.organizationName,
          customerFacingName: settings.customerFacingName,
          logoUrl: settings.logoUrl,
          timezone: settings.timezone,
          defaultLanguage: settings.defaultLanguage,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: WorkspaceSettings };
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
      description="Workspace identity shown across your account. Widget look-and-feel stays under Widget; agent behavior under Agents."
    >
      <section className="ink-card p-6 space-y-5">
        <label className="block space-y-1.5">
          <FieldLabel>Workspace / company name</FieldLabel>
          <input
            className="ink-input"
            value={settings.organizationName}
            onChange={(e) =>
              setSettings({ ...settings, organizationName: e.target.value })
            }
          />
          <FieldHint>Internal name for your Neylon AI workspace.</FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Customer-facing name</FieldLabel>
          <input
            className="ink-input"
            value={settings.customerFacingName ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                customerFacingName: e.target.value || null,
              })
            }
            placeholder={settings.organizationName}
          />
          <FieldHint>
            Optional public name customers may see. Does not change Widget
            branding colors or launcher — those live under Widget.
          </FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Logo URL</FieldLabel>
          <input
            className="ink-input"
            value={settings.logoUrl ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, logoUrl: e.target.value || null })
            }
            placeholder="https://…"
          />
          <FieldHint>
            Workspace logo reference. Widget avatar and theme remain in Widget.
          </FieldHint>
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
            Used for business hours and timestamps in your workspace.
          </FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Default language</FieldLabel>
          <select
            className="ink-input py-2"
            value={settings.defaultLanguage}
            onChange={(e) =>
              setSettings({ ...settings, defaultLanguage: e.target.value })
            }
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <p className="caption text-xs">
          Slug: <span className="mono">{settings.organizationSlug}</span>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ink"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save general settings"}
          </button>
          {message ? <span className="caption text-sm">{message}</span> : null}
        </div>
      </section>
    </SettingsSectionFrame>
  );
}
