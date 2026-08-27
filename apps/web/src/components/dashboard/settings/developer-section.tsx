"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsSectionFrame, SettingsButton } from "./settings-ui";
import { CodeBlock } from "./code-block";
import { buildWidgetSnippet } from "@/lib/widget-script";

export function DeveloperSettingsSection() {
  // The publishable key is stored retrievably (it ships inside client HTML, à
  // la Stripe pk_live), so we pre-fill the snippet with the real key on load.
  // `apiKey` holds a key freshly minted/rotated this session; `publicKey` is
  // the retrievable value from the list read; `keyDisplay` is the masked
  // prefix…last4 for context. Keys created before the retrievable column exist
  // only as a hash — those must be rotated to become copyable.
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [keyDisplay, setKeyDisplay] = useState<string | null>(null);
  const [activeOrigins, setActiveOrigins] = useState<string[]>([]);
  const [hasActiveKey, setHasActiveKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const loadKey = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/api-keys");
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          apiKeys: Array<{
            revoked: boolean;
            display: string;
            publicKey?: string | null;
            allowedOrigins?: string[];
          }>;
        };
      };
      if (json.success && json.data) {
        const active = json.data.apiKeys.find((k) => !k.revoked);
        setHasActiveKey(Boolean(active));
        setKeyDisplay(active?.display ?? null);
        setActiveOrigins(active?.allowedOrigins ?? []);
        setPublicKey(active?.publicKey ?? null);
      }
    } catch {
      // Non-fatal: the snippet still renders with a placeholder + a mint button.
    }
  }, []);

  useEffect(() => {
    void loadKey();
  }, [loadKey]);

  // Idempotent, non-rotating mint (the same path as Copy on the Overview): mints
  // a key only when the org has none, otherwise returns the existing one. A
  // legacy hash-only key comes back as needsRotate → the user rotates instead.
  const ensureKey = async () => {
    setGenerating(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/v1/api-keys/ensure", { method: "POST" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { apiKey: string | null; created: boolean; needsRotate: boolean };
        error?: string;
      };
      if (!json.success) {
        throw new Error(json.error ?? "Could not create a key.");
      }
      if (json.data?.needsRotate) {
        setKeyError(
          "Your existing key predates copyable snippets. Rotate it to get one.",
        );
        return;
      }
      if (json.data?.apiKey) {
        setApiKey(json.data.apiKey);
        await loadKey();
      }
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Could not create a key.");
    } finally {
      setGenerating(false);
    }
  };

  // Rotating preserves any domains the org already configured, so generating
  // here never silently wipes their allowlist. This is the advanced action —
  // it invalidates the current key and any embeds still using it.
  const generateKey = async () => {
    setGenerating(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Widget", allowedOrigins: activeOrigins }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { apiKey: string };
        error?: string;
      };
      if (!json.success || !json.data?.apiKey) {
        throw new Error(json.error ?? "Could not generate a key.");
      }
      setApiKey(json.data.apiKey);
      await loadKey();
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Could not generate a key.");
    } finally {
      setGenerating(false);
    }
  };

  const snippetKey = apiKey ?? publicKey ?? "nk_live_YOUR_API_KEY";
  const hasCopyableKey = Boolean(apiKey ?? publicKey);

  return (
    <SettingsSectionFrame
      id="developer-section"
      title="Install Widget"
      description="Add the widget to your site. Your key is limited to your connected website's domain, set under Integrations → Website."
    >
      <section className="ink-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-1">
            Add the widget via Script Tag
          </h3>
          <p className="caption text-sm text-[var(--muted)]">
            Paste this snippet into your site&apos;s <code>&lt;head&gt;</code> or footer. It works automatically with Webflow, Framer, WordPress, or any HTML site.
          </p>
        </div>
        <CodeBlock
          language="html"
          label="Script tag"
          code={`<!-- Add this to your site's <head> or before </body> -->
${buildWidgetSnippet(snippetKey)}`}
        />

        {hasCopyableKey ? (
          <div className="space-y-2">
            <p className="caption text-sm text-[var(--muted)]">
              Your live key is filled into the snippet above — copy it and
              paste it on your site.
            </p>
            <button
              type="button"
              className="caption text-xs underline underline-offset-4 disabled:opacity-60"
              disabled={generating}
              onClick={() => void generateKey()}
            >
              {generating
                ? "Rotating…"
                : "Rotate key (invalidates the current one)"}
            </button>
          </div>
        ) : hasActiveKey ? (
          <div className="space-y-2">
            <SettingsButton
              className="bg-[var(--blue)] text-white"
              disabled={generating}
              onClick={() => void generateKey()}
            >
              {generating ? "Rotating…" : "Rotate to get a copyable key"}
            </SettingsButton>
            <p className="caption text-xs text-[var(--muted)]">
              Your current key
              {keyDisplay ? ` (${keyDisplay})` : ""} predates copyable
              snippets. Rotating issues a new key and fills it into the snippet
              — embeds using the old key stop working.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <SettingsButton
              className="bg-[var(--blue)] text-white"
              disabled={generating}
              onClick={() => void ensureKey()}
            >
              {generating ? "Creating…" : "Create my key & fill snippet"}
            </SettingsButton>
            <p className="caption text-xs text-[var(--muted)]">
              Creates your publishable key and drops it straight into the
              snippet above — the same key you get from Copy on the Overview.
            </p>
          </div>
        )}

        {keyError ? (
          <p className="text-sm text-red-700" role="alert">
            {keyError}
          </p>
        ) : null}

        <p className="caption text-xs text-[var(--muted)]">
          This key is limited to your connected website&apos;s domain. Connect
          or change it under{" "}
          <Link className="underline" href="/dashboard/integrations">
            Integrations → Website
          </Link>
          .
        </p>
      </section>
    </SettingsSectionFrame>
  );
}
