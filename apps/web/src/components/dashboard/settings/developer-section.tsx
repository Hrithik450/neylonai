"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { SettingsSectionFrame } from "./settings-ui";
import { CodeBlock } from "./code-block";
import { DEVELOPER_SDK_INSTALL_SKILL } from "./developer-sdk-install-skill";

type Mode = "manual" | "agent";

export function DeveloperSettingsSection() {
  const [mode, setMode] = useState<Mode>("manual");
  const [copied, setCopied] = useState(false);

  const copySkill = async () => {
    try {
      await navigator.clipboard.writeText(DEVELOPER_SDK_INSTALL_SKILL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <SettingsSectionFrame
      id="developer-section"
      title="Developer"
      description="Install the SDK. API keys and domains are under API keys."
    >
      <div
        id="sdk-mode-options"
        className="inline-flex rounded-full border border-[var(--ink)] overflow-hidden text-sm"
      >
        {(
          [
            { id: "manual", label: "Manual" },
            { id: "agent", label: "Install with coding agent" },
          ] as { id: Mode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            className="cursor-pointer px-4 py-1.5 transition-colors whitespace-nowrap"
            style={
              mode === opt.id
                ? { background: "var(--ink)", color: "#fff" }
                : { background: "#fff" }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "manual" ? (
        <div className="space-y-6">
          <section className="ink-card p-6 space-y-4">
            <div>
              <h3 id="sdk-snippet-heading" className="text-lg font-medium mb-1">
                1. Install the SDK
              </h3>
              <p className="caption text-sm text-[var(--muted)]">
                Add @neylonai/sdk to your project using your package manager.
              </p>
            </div>
            <CodeBlock
              language="bash"
              label="Install with npm or pnpm"
              code={`npm install @neylonai/sdk
# or
pnpm add @neylonai/sdk`}
            />
          </section>

          <section className="ink-card p-6 space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-1">
                2. Mount the support widget
              </h3>
              <p className="caption text-sm text-[var(--muted)]">
                Initialize the widget once in your app shell. Mount it on
                client-side only and call{" "}
                <code className="text-xs bg-[var(--cream)]/40 px-1.5 py-0.5 rounded">
                  unmount()
                </code>{" "}
                during cleanup. Use your public API key from the dashboard
                (Settings → API keys).
              </p>
            </div>
            <CodeBlock
              language="typescript"
              label="Main app setup"
              code={`import { mountSupportWidget } from "@neylonai/sdk/embed";

const widget = await mountSupportWidget({
  config: {
    apiKey: "nk_live_…",
    pagePath: window.location.pathname,
  },
});

// Update widget wherever user context changes: route changes, login/logout, user data updates
widget.update({
  config: {
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
  },
});`}
            />
          </section>

          <section className="ink-card p-6 space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-1">
                3. Mark page sections
              </h3>
              <p className="caption text-sm text-[var(--muted)]">
                Give major page blocks a stable <code className="text-xs">id</code>{" "}
                on <code className="text-xs">&lt;section&gt;</code> or{" "}
                <code className="text-xs">&lt;article&gt;</code> elements. After
                your Website import, Neylon crawls those ids and the widget
                auto-tracks them.
              </p>
            </div>

            <CodeBlock
              language="text"
              label="Section markup"
              code={`<section id="pricing">
  <h2>Pricing</h2>
  ...
</section>`}
            />
          </section>
        </div>
      ) : (
        <section className="ink-card p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">Install with coding agent</h3>
            <p className="caption text-sm max-w-2xl">
              Your agent installs @neylonai/sdk, wires your publishable API key,
              and marks major page blocks with stable element{" "}
              <code className="text-xs">id</code> values after Website import.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--ink)]/20 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/10 px-4 py-3">
              <div>
                <h4 className="font-medium">Coding agent instructions</h4>
              </div>
              <button
                type="button"
                className="btn-ink flex size-9 items-center justify-center bg-white p-0"
                onClick={() => void copySkill()}
                aria-label={
                  copied
                    ? "Coding agent instructions copied"
                    : "Copy coding agent instructions"
                }
                title={copied ? "Copied" : "Copy instructions"}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </button>
            </div>
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed">
              {DEVELOPER_SDK_INSTALL_SKILL}
            </pre>
          </div>
        </section>
      )}
    </SettingsSectionFrame>
  );
}
