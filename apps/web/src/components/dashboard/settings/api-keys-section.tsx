"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FieldHint,
  SettingsButton,
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

export function ApiKeysSettingsSection() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [onceKey, setOnceKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const keysRes = await fetch("/api/v1/api-keys");
    const keysJson = (await keysRes.json()) as {
      success: boolean;
      data?: { apiKeys: KeyRow[] };
      error?: string;
    };
    if (keysJson.success && keysJson.data) {
      setKeys(keysJson.data.apiKeys);
    } else setMessage(keysJson.error ?? "Failed to load keys");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKeys = keys.filter((k) => !k.revoked);
  // One org = one website = one domain. The allowlist is owned by Integrations →
  // Website now; here it's read-only context.
  const allowedDomain = activeKeys[0]?.allowedOrigins?.[0] ?? null;

  const rotateKey = async () => {
    if (
      !confirm(
        "Rotate the API key? Existing embeds using the old key will stop working until updated.",
      )
    ) {
      return;
    }
    setBusy(true);
    setOnceKey(null);
    setMessage(null);
    try {
      // Preserve the domain the connected website set, so rotating never wipes
      // the allowlist.
      const origins = activeKeys[0]?.allowedOrigins ?? [];
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
      setMessage("New key created. Copy it now. It won’t be shown again.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Rotate failed");
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

  return (
    <SettingsSectionFrame
      headingId="api-keys-heading"
      title="API keys"
      description="Publishable keys for the browser widget, limited to your connected website's domain."
    >
      <section id="api-keys-card" className="ink-card p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">API Keys</h3>
          <p className="caption text-sm">
            These identify your embed in the browser. Most people never touch
            this — your key is minted the first time you copy the install script.
            The full key is shown only once when created or rotated.
          </p>
        </div>

        {onceKey ? (
          <div className="rounded-xl border border-[var(--ink)] bg-[var(--cream)] p-4 space-y-2">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider">
              Copy now. Shown once
            </p>
            <code className="block break-all text-sm font-semibold">{onceKey}</code>
            <SettingsButton
              className="bg-white text-xs"
              onClick={() => void navigator.clipboard.writeText(onceKey)}
            >
              Copy to clipboard
            </SettingsButton>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <SettingsButton
            className="bg-[var(--blue)] text-white"
            disabled={busy}
            onClick={() => void rotateKey()}
          >
            {activeKeys.length === 0 ? "Create key" : "Rotate key"}
          </SettingsButton>
        </div>

        <ul className="divide-y divide-[var(--ink)] border-t border-[var(--ink)]">
          {activeKeys.length === 0 ? (
            <li className="caption py-4 text-sm">No active keys.</li>
          ) : (
            activeKeys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-sm mono">{k.display}</p>
                  <p className="caption text-xs">
                    {k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : "Never used"}
                  </p>
                </div>
                <SettingsButton
                  className="bg-white text-xs"
                  disabled={busy}
                  onClick={() => void revoke(k.id)}
                >
                  Revoke
                </SettingsButton>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ink-card p-6 space-y-3">
        <h3 className="text-lg font-medium">Allowed domain</h3>
        <FieldHint>
          Your widget key only works on your connected website. Set or change it
          under Integrations → Website — not here.
        </FieldHint>
        {allowedDomain ? (
          <p className="text-sm">
            <span className="mono font-semibold">{allowedDomain}</span>
            <span className="caption"> — from your connected website</span>
          </p>
        ) : (
          <p className="caption text-sm">
            No domain set yet — the key works everywhere until you connect a
            website under{" "}
            <Link className="underline" href="/dashboard/integrations">
              Integrations → Website
            </Link>
            .
          </p>
        )}
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </SettingsSectionFrame>
  );
}
