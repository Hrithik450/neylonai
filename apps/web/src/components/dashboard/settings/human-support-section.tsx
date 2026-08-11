"use client";

import { useCallback, useEffect, useState } from "react";
import type { EngagementSettings } from "@neylonai/domain/conversations";
import Link from "next/link";
import {
  FieldHint,
  FieldLabel,
  SettingsSectionFrame,
} from "./settings-ui";

type Form = Pick<
  EngagementSettings,
  | "humanHandoffEnabled"
  | "defaultTeam"
  | "availabilityMode"
  | "businessHoursNote"
  | "customerHandoffMessage"
  | "unavailableMessage"
>;

/**
 * Human Support — workspace handoff / escalation defaults only.
 * Lead Agent field config stays under Agents.
 */
export function HumanSupportSettingsSection() {
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/engagement-settings");
    const json = (await res.json()) as {
      success: boolean;
      data?: { settings: EngagementSettings };
      error?: string;
    };
    if (json.success && json.data) {
      const s = json.data.settings;
      setForm({
        humanHandoffEnabled: s.humanHandoffEnabled,
        defaultTeam: s.defaultTeam,
        availabilityMode: s.availabilityMode,
        businessHoursNote: s.businessHoursNote,
        customerHandoffMessage: s.customerHandoffMessage,
        unavailableMessage: s.unavailableMessage,
      });
    } else setMessage(json.error ?? "Failed to load");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/engagement-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: EngagementSettings };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Save failed");
      const s = json.data.settings;
      setForm({
        humanHandoffEnabled: s.humanHandoffEnabled,
        defaultTeam: s.defaultTeam,
        availabilityMode: s.availabilityMode,
        businessHoursNote: s.businessHoursNote,
        customerHandoffMessage: s.customerHandoffMessage,
        unavailableMessage: s.unavailableMessage,
      });
      setMessage("Human support settings saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return <p className="caption text-sm">{message ?? "Loading…"}</p>;
  }

  return (
    <SettingsSectionFrame
      title="Human Support"
      description="How async human follow-up works when a person is needed. This is not live chat — the team follows up offline. Agent-specific escalation toggles live under Support Agent configuration."
    >
      <section className="ink-card p-6 space-y-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.humanHandoffEnabled}
            onChange={(e) =>
              setForm({ ...form, humanHandoffEnabled: e.target.checked })
            }
          />
          <span>
            <span className="font-medium block">Allow human handoff</span>
            <span className="caption text-xs">
              When off, conversations stay with AI and escalations are not
              created.
            </span>
          </span>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Business hours note</FieldLabel>
          <textarea
            className="ink-input min-h-[4rem]"
            value={form.businessHoursNote}
            onChange={(e) =>
              setForm({ ...form, businessHoursNote: e.target.value })
            }
          />
          <FieldHint>
            Appended to the customer message when follow-up timing is set to
            business hours. Timezone is under General.
          </FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Default escalation team</FieldLabel>
          <input
            className="ink-input"
            value={form.defaultTeam}
            onChange={(e) =>
              setForm({ ...form, defaultTeam: e.target.value })
            }
            placeholder="support"
          />
          <FieldHint>
            Default team when a conversation is escalated for follow-up.
          </FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Follow-up timing</FieldLabel>
          <select
            className="ink-input py-2"
            value={form.availabilityMode}
            onChange={(e) =>
              setForm({
                ...form,
                availabilityMode: e.target
                  .value as Form["availabilityMode"],
              })
            }
          >
            <option value="always">Standard follow-up message</option>
            <option value="business_hours">
              Append business-hours note
            </option>
            <option value="collect_contact">
              Standard follow-up (collect contact if needed)
            </option>
          </select>
          <FieldHint>
            Async team follow-up only — never claims a human is online.
          </FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Customer message when escalated</FieldLabel>
          <textarea
            className="ink-input min-h-[5rem]"
            value={form.customerHandoffMessage}
            onChange={(e) =>
              setForm({ ...form, customerHandoffMessage: e.target.value })
            }
          />
          <FieldHint>
            Shown in chat after escalation. A short reference code is appended
            automatically.
          </FieldHint>
        </label>

        <label className="block space-y-1.5">
          <FieldLabel>Legacy fallback message</FieldLabel>
          <textarea
            className="ink-input min-h-[5rem]"
            value={form.unavailableMessage}
            onChange={(e) =>
              setForm({ ...form, unavailableMessage: e.target.value })
            }
          />
          <FieldHint>
            Kept for older workspaces; new escalations use the message above.
          </FieldHint>
        </label>

        <p className="caption text-xs">
          Fine-tune Support Agent escalation conditions under{" "}
          <Link href="/dashboard/agents?agent=neylonai-chatbot" className="underline">
            Agents → Support Agent
          </Link>
          .
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ink"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save human support"}
          </button>
          {message ? <span className="caption text-sm">{message}</span> : null}
        </div>
      </section>
    </SettingsSectionFrame>
  );
}
