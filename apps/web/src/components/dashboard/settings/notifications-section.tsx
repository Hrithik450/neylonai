"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSettings } from "@neylonai/domain/workspace/types";
import Link from "next/link";
import {
  FieldHint,
  SettingsSectionFrame,
} from "./settings-ui";

export function NotificationsSettingsSection() {
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
        body: JSON.stringify({ notifications: settings.notifications }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: WorkspaceSettings };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Save failed");
      setSettings(json.data.settings);
      setMessage("Notification preferences saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return <p className="caption text-sm">{message ?? "Loading…"}</p>;
  }

  const n = settings.notifications;
  const toggle = (key: keyof typeof n) =>
    setSettings({
      ...settings,
      notifications: { ...n, [key]: !n[key] },
    });

  return (
    <SettingsSectionFrame
      title="Notifications"
      description="Choose when your team is notified. Connecting Slack or webhooks is done under Integrations — this only sets preferences."
    >
      <section className="ink-card p-6 space-y-5">
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Human handoff</h3>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={n.humanHandoffEmail}
              onChange={() => toggle("humanHandoffEmail")}
            />
            Email when a conversation needs a human
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={n.humanHandoffSlack}
              onChange={() => toggle("humanHandoffSlack")}
            />
            Slack when a conversation needs a human
          </label>
        </div>

        <div className="space-y-3 border-t border-[var(--ink)]/15 pt-5">
          <h3 className="text-lg font-medium">Escalations</h3>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={n.ticketEmail}
              onChange={() => toggle("ticketEmail")}
            />
            Email on new or assigned escalations
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={n.ticketSlack}
              onChange={() => toggle("ticketSlack")}
            />
            Slack on new or assigned escalations
          </label>
        </div>

        <div className="space-y-3 border-t border-[var(--ink)]/15 pt-5">
          <h3 className="text-lg font-medium">Leads</h3>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={n.leadEmail}
              onChange={() => toggle("leadEmail")}
            />
            Email when Lead Agent captures a lead
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={n.leadSlack}
              onChange={() => toggle("leadSlack")}
            />
            Slack when Lead Agent captures a lead
          </label>
        </div>

        <FieldHint>
          Slack delivery requires a connected Slack integration.{" "}
          <Link href="/dashboard/integrations" className="underline">
            Manage integrations
          </Link>
        </FieldHint>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ink"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save notifications"}
          </button>
          {message ? <span className="caption text-sm">{message}</span> : null}
        </div>
      </section>
    </SettingsSectionFrame>
  );
}
