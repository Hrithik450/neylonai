"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSettings } from "@neylonai/domain/workspace/types";
import Link from "next/link";
import {
  FieldHint,
  FieldLabel,
  SettingsSectionFrame,
} from "./settings-ui";

/**
 * Developer account settings: SDK, webhooks, docs.
 * Widget keys/domains live under Security. Widget UI under Widget.
 */
export function DeveloperSettingsSection() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/workspace-settings");
    const json = (await res.json()) as {
      success: boolean;
      data?: { settings: WorkspaceSettings };
      error?: string;
    };
    if (json.success && json.data) {
      setSettings(json.data.settings);
      setWebhookUrl(json.data.settings.webhookUrl ?? "");
    } else setMessage(json.error ?? "Failed to load");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveWebhook = async (rotate: boolean) => {
    setBusy(true);
    setSecretOnce(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/workspace-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim() || null,
          rotateWebhookSecret: rotate || undefined,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          settings: WorkspaceSettings;
          webhookSecretOnce: string | null;
        };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Save failed");
      setSettings(json.data.settings);
      if (json.data.webhookSecretOnce) {
        setSecretOnce(json.data.webhookSecretOnce);
        setMessage("Webhook secret created. Copy it now — it won’t be shown again.");
      } else {
        setMessage("Webhook settings saved.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const clearSecret = async () => {
    if (!confirm("Clear the webhook signing secret?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/workspace-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearWebhookSecret: true }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { settings: WorkspaceSettings };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Clear failed");
      setSettings(json.data.settings);
      setSecretOnce(null);
      setMessage("Webhook secret cleared.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSectionFrame
      title="Developer"
      description="Install the SDK and configure server-side webhooks. Browser widget keys and domains are under Security."
    >
      <section className="ink-card p-6 space-y-3">
        <h3 className="text-lg font-medium">API information</h3>
        <p className="caption text-sm">
          Workspace ID:{" "}
          <span className="mono">{settings?.organizationId ?? "…"}</span>
        </p>
        <p className="caption text-sm">
          Slug: <span className="mono">{settings?.organizationSlug ?? "…"}</span>
        </p>
        <FieldHint>
          Use widget API keys from{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              window.location.hash = "";
              const url = new URL(window.location.href);
              url.searchParams.set("section", "security");
              window.location.href = url.toString();
            }}
          >
            Security
          </button>{" "}
          for browser embeds. Server secrets never go in the SDK.
        </FieldHint>
      </section>

      <section className="ink-card p-6 space-y-3">
        <h3 className="text-lg font-medium">SDK installation</h3>
        <p className="caption text-sm">
          Only an API key is required. Anonymous visitors work by default. Widget
          branding and behavior are managed here in the dashboard and applied by
          the SDK automatically — do not set colors, fonts, or logo in your app
          code. Optional: pass a signed-in user from your existing auth.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-[var(--ink)] bg-white p-4 text-xs leading-relaxed">
{`import { SupportWidget } from "@neylonai/sdk/react";

<SupportWidget
  config={{
    apiKey: "nk_live_…",  // from Settings → Security
  }}
/>

// Optional — page path + existing auth user
<SupportWidget
  config={{
    apiKey: "nk_live_…",
    pagePath: window.location.pathname,
    user: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          profile_image: currentUser.image,
        }
      : null,
  }}
/>`}
        </pre>
        <p className="caption text-xs">
          Supported user fields: <code>id</code>, <code>name</code>,{" "}
          <code>email</code>, <code>profile_image</code>. Appearance:{" "}
          <Link href="/dashboard/widget" className="underline">
            Widget
          </Link>
          .
        </p>
      </section>

      <section className="ink-card p-6 space-y-4">
        <h3 className="text-lg font-medium">Webhook configuration</h3>
        <p className="caption text-sm">
          Server-side outbound webhook for events (leads, escalations, handoffs).
          The signing secret is server-only — never embed it in the browser.
        </p>
        <label className="block space-y-1.5">
          <FieldLabel>Webhook URL</FieldLabel>
          <input
            className="ink-input"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-api.example.com/neylonai-hooks"
          />
        </label>

        {secretOnce ? (
          <div className="rounded-xl border border-[var(--ink)] bg-[var(--cream)] p-4 space-y-2">
            <p className="mono text-[0.65rem] font-bold uppercase tracking-wider">
              Webhook secret — copy now
            </p>
            <code className="block break-all text-sm font-semibold">
              {secretOnce}
            </code>
          </div>
        ) : null}

        <p className="caption text-xs">
          {settings?.hasWebhookSecret
            ? `Secret configured (…${settings.webhookSecretLastFour ?? "****"})`
            : "No webhook secret configured"}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ink"
            disabled={busy}
            onClick={() => void saveWebhook(false)}
          >
            Save URL
          </button>
          <button
            type="button"
            className="btn-ink bg-white"
            disabled={busy}
            onClick={() => void saveWebhook(true)}
          >
            Rotate secret
          </button>
          {settings?.hasWebhookSecret ? (
            <button
              type="button"
              className="btn-ink bg-white"
              disabled={busy}
              onClick={() => void clearSecret()}
            >
              Clear secret
            </button>
          ) : null}
        </div>
        <FieldHint>
          For Slack/CRM product connections, use{" "}
          <Link href="/dashboard/integrations" className="underline">
            Integrations
          </Link>
          .
        </FieldHint>
      </section>

      <section className="ink-card p-6 space-y-2">
        <h3 className="text-lg font-medium">Documentation</h3>
        <ul className="caption text-sm space-y-1 list-disc pl-5">
          <li>Widget & SDK — use your deployment host and Security keys</li>
          <li>Webhooks — verify signatures with the server-side secret</li>
          <li>Analytics — detailed product analytics live in Evently</li>
        </ul>
      </section>

      {message ? <p className="caption text-sm">{message}</p> : null}
    </SettingsSectionFrame>
  );
}
