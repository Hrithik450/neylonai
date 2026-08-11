"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSettings } from "@neylonai/domain/workspace/types";
import {
  FieldHint,
  FieldLabel,
  SettingsSectionFrame,
} from "./settings-ui";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  allowedOrigins: string[];
  revoked: boolean;
  display: string;
  lastUsedAt: string | null;
  createdAt: string | null;
};

/**
 * Security: widget (browser-safe) API keys + domains, sessions, SSO prep.
 * Full secrets shown only once at create/rotate. Never re-displayed.
 */
export function SecuritySettingsSection() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [originsDraft, setOriginsDraft] = useState("");
  const [onceKey, setOnceKey] = useState<string | null>(null);
  const [sso, setSso] = useState<WorkspaceSettings["sso"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [keysRes, wsRes] = await Promise.all([
      fetch("/api/v1/api-keys"),
      fetch("/api/v1/workspace-settings"),
    ]);
    const keysJson = (await keysRes.json()) as {
      success: boolean;
      data?: { apiKeys: KeyRow[] };
      error?: string;
    };
    const wsJson = (await wsRes.json()) as {
      success: boolean;
      data?: { settings: WorkspaceSettings };
    };
    if (keysJson.success && keysJson.data) {
      setKeys(keysJson.data.apiKeys);
      const active = keysJson.data.apiKeys.find((k) => !k.revoked);
      setOriginsDraft((active?.allowedOrigins ?? []).join("\n"));
    } else setMessage(keysJson.error ?? "Failed to load keys");
    if (wsJson.success && wsJson.data) setSso(wsJson.data.settings.sso);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKeys = keys.filter((k) => !k.revoked);

  const rotateKey = async () => {
    if (
      !confirm(
        "Rotate the widget API key? Existing embeds using the old key will stop working until updated.",
      )
    ) {
      return;
    }
    setBusy(true);
    setOnceKey(null);
    setMessage(null);
    try {
      const origins = originsDraft
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Widget", allowedOrigins: origins }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { apiKey: string };
        error?: string;
      };
      if (!json.success || !json.data?.apiKey) {
        throw new Error(json.error ?? "Rotate failed");
      }
      setOnceKey(json.data.apiKey);
      setMessage("New key created. Copy it now — it won’t be shown again.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Rotate failed");
    } finally {
      setBusy(false);
    }
  };

  const saveOrigins = async () => {
    const active = activeKeys[0];
    if (!active) return;
    setBusy(true);
    try {
      const origins = originsDraft
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/v1/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId: active.id, allowedOrigins: origins }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Update failed");
      setMessage("Allowed domains updated.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (apiKeyId: string) => {
    if (!confirm("Revoke this key?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Revoke failed");
      setMessage("Key revoked.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  const saveSsoPrep = async () => {
    if (!sso) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/workspace-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sso }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Save failed");
      setMessage("SSO preferences saved (architecture prep — not live IdP).");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSectionFrame
      title="Security"
      description="Protect how your workspace connects to browsers and servers. Widget appearance stays under Widget."
    >
      <section className="ink-card p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Widget API keys (browser-safe)</h3>
          <p className="caption text-sm">
            These identify your embed in the browser. They are restricted by
            allowed domains and never grant billing or database access. The full
            key is shown only once when created or rotated.
          </p>
        </div>

        {onceKey ? (
          <div className="rounded-xl border border-[var(--ink)] bg-[var(--cream)] p-4 space-y-2">
            <p className="mono text-[0.65rem] font-bold uppercase tracking-wider">
              Copy now — shown once
            </p>
            <code className="block break-all text-sm font-semibold">{onceKey}</code>
            <button
              type="button"
              className="btn-ink bg-white px-3 py-1.5 text-xs"
              onClick={() => void navigator.clipboard.writeText(onceKey)}
            >
              Copy to clipboard
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ink bg-[var(--blue)] text-white text-xs px-4 py-2"
            disabled={busy}
            onClick={() => void rotateKey()}
          >
            Create / rotate key
          </button>
        </div>

        <ul className="divide-y divide-[var(--ink)] border-t border-[var(--ink)]">
          {activeKeys.length === 0 ? (
            <li className="caption py-4 text-sm">No active widget keys.</li>
          ) : (
            activeKeys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-sm mono">{k.display}</p>
                  <p className="caption text-xs">
                    {k.name}
                    {k.lastUsedAt
                      ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : " · never used"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revoke(k.id)}
                  className="btn-ink bg-white px-3 py-1.5 text-xs"
                >
                  Revoke
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ink-card p-6 space-y-3">
        <h3 className="text-lg font-medium">Allowed widget domains</h3>
        <FieldHint>
          Restrict which websites may use your widget key. One host per line
          (example.com or https://app.example.com). Empty means unrestricted —
          not recommended for production.
        </FieldHint>
        <textarea
          className="ink-input min-h-28"
          value={originsDraft}
          onChange={(e) => setOriginsDraft(e.target.value)}
          placeholder={"example.com\napp.example.com"}
        />
        <button
          type="button"
          className="btn-ink bg-white text-xs px-4 py-2"
          disabled={busy || activeKeys.length === 0}
          onClick={() => void saveOrigins()}
        >
          Save domains
        </button>
      </section>

      <section className="ink-card p-6 space-y-3">
        <h3 className="text-lg font-medium">Active sessions</h3>
        <p className="caption text-sm">
          You are signed in with Google on this browser. Sign out from the
          header to end this session. Multi-device session management will
          expand here later.
        </p>
      </section>

      <section className="ink-card p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Single sign-on (SSO) prep</h3>
          <p className="caption text-sm">
            Architecture placeholder for future SSO. Saving preferences does not
            enable an identity provider yet.
          </p>
        </div>
        {sso ? (
          <>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={sso.enabled}
                onChange={(e) =>
                  setSso({ ...sso, enabled: e.target.checked })
                }
              />
              Plan to require SSO for this workspace
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Preferred provider</FieldLabel>
              <input
                className="ink-input"
                value={sso.provider ?? ""}
                onChange={(e) =>
                  setSso({ ...sso, provider: e.target.value || null })
                }
                placeholder="Okta, Google Workspace, Azure AD…"
              />
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                className="ink-input min-h-[4rem]"
                value={sso.notes ?? ""}
                onChange={(e) =>
                  setSso({ ...sso, notes: e.target.value || null })
                }
              />
            </label>
            <button
              type="button"
              className="btn-ink"
              disabled={busy}
              onClick={() => void saveSsoPrep()}
            >
              Save SSO preferences
            </button>
          </>
        ) : null}
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </SettingsSectionFrame>
  );
}
