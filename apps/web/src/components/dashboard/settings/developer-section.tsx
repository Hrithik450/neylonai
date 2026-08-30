"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  SettingsSectionFrame,
  SettingsButton,
  FieldLabel,
  FieldHint,
} from "./settings-ui";
import { CodeBlock } from "./code-block";
import { buildWidgetSnippet } from "@/lib/widget-script";
import {
  mergeWidgetConfig,
  normalizePathRule,
  validatePathRule,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";

function linesFromList(items: string[] | undefined): string {
  return (items ?? []).join("\n");
}

function listFromLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizePathRule(s))
    .filter(Boolean);
}

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

  // Widget config & page targeting
  const [widgetConfig, setWidgetConfig] = useState<StoredWidgetConfig | null>(null);
  const [hiddenPathsInput, setHiddenPathsInput] = useState("");
  const [autoOpenPathsInput, setAutoOpenPathsInput] = useState("");
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMessage, setRulesMessage] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);

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

  const loadWidgetConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/widget-config");
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          config: StoredWidgetConfig;
        };
      };
      if (json.success && json.data?.config) {
        const cfg = json.data.config;
        setWidgetConfig(cfg);
        setHiddenPathsInput(linesFromList(cfg.website?.hiddenPathPrefixes));
        setAutoOpenPathsInput(linesFromList(cfg.website?.autoOpenPathPrefixes));
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void loadKey();
    void loadWidgetConfig();
  }, [loadKey, loadWidgetConfig]);

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

  const savePageRules = async () => {
    setSavingRules(true);
    setRulesMessage(null);
    setRulesError(null);

    // Validate hidden paths
    const rawHidden = hiddenPathsInput.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const line of rawHidden) {
      const err = validatePathRule(line);
      if (err) {
        setRulesError(err);
        setSavingRules(false);
        return;
      }
    }

    // Validate auto-open paths
    const rawAutoOpen = autoOpenPathsInput.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const line of rawAutoOpen) {
      const err = validatePathRule(line);
      if (err) {
        setRulesError(err);
        setSavingRules(false);
        return;
      }
    }

    try {
      const nextConfig = mergeWidgetConfig({
        ...(widgetConfig ?? {}),
        website: {
          hiddenPathPrefixes: listFromLines(hiddenPathsInput),
          visiblePathPrefixes: [],
          autoOpenPathPrefixes: listFromLines(autoOpenPathsInput),
        },
      });
      const res = await fetch("/api/v1/widget-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { config: StoredWidgetConfig };
        error?: string;
      };
      if (!json.success || !json.data?.config) {
        throw new Error(json.error ?? "Could not save page rules.");
      }
      setWidgetConfig(json.data.config);
      setRulesMessage("Page targeting rules saved successfully.");
      window.setTimeout(() => setRulesMessage(null), 4000);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : "Could not save page rules.");
    } finally {
      setSavingRules(false);
    }
  };

  const snippetKey = apiKey ?? publicKey ?? "nk_live_YOUR_API_KEY";
  const hasCopyableKey = Boolean(apiKey ?? publicKey);

  return (
    <SettingsSectionFrame
      id="developer-section"
      title="Installation Guide"
      description="Add the widget to your website and configure page targeting rules."
    >
      {/* 1. Script Tag Installation */}
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

      {/* 2. Page Targeting & Rules */}
      <section className="ink-card p-6 space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Page Targeting & Rules</h3>
          <p className="caption text-sm text-[var(--muted)]">
            Control which URLs display or hide the support widget on your website. No code changes required.
          </p>
        </div>

        <div className="space-y-4">
          {/* Excluded Pages */}
          <div className="space-y-1.5">
            <FieldLabel>Exclude Paths (Hide Widget)</FieldLabel>
            <textarea
              className="ink-input min-h-24 mono text-xs"
              placeholder={"/dashboard\n/admin\n/checkout\n/account"}
              value={hiddenPathsInput}
              onChange={(e) => setHiddenPathsInput(e.target.value)}
            />
            <FieldHint>
              Page paths where the widget will never appear (one per line, e.g. <code>/dashboard</code> or <code>/admin</code>). All subpages are automatically included.
            </FieldHint>
          </div>

          {/* Auto-Open Pages */}
          <div className="space-y-1.5">
            <FieldLabel>Auto-Open Widget Paths (Optional)</FieldLabel>
            <textarea
              className="ink-input min-h-20 mono text-xs"
              placeholder={"/contact\n/support"}
              value={autoOpenPathsInput}
              onChange={(e) => setAutoOpenPathsInput(e.target.value)}
            />
            <FieldHint>
              Paths where the widget chat panel should automatically expand when a visitor loads the page.
            </FieldHint>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <SettingsButton
            className="bg-[var(--ink)] text-white"
            disabled={savingRules}
            onClick={() => void savePageRules()}
          >
            {savingRules ? "Saving rules…" : "Save Page Rules"}
          </SettingsButton>

          {rulesMessage ? (
            <span className="caption text-xs text-emerald-700 font-medium">
              ✓ {rulesMessage}
            </span>
          ) : null}

          {rulesError ? (
            <span className="caption text-xs text-red-700 font-medium">
              {rulesError}
            </span>
          ) : null}
        </div>
      </section>
    </SettingsSectionFrame>
  );
}
