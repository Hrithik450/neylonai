"use client";

import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { WIDGET_CODING_AGENT_SKILL } from "./widget-coding-agent-skill";

export function WidgetCodingAgentConfig() {
  const [copied, setCopied] = useState(false);

  const copySkill = async () => {
    try {
      await navigator.clipboard.writeText(WIDGET_CODING_AGENT_SKILL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="widget-coding-agent-config"
      className="ink-card p-5 sm:p-6 space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Configure with coding agent</h2>
        <p className="caption text-sm max-w-2xl">
          Your agent reuses the installed SDK when present, installs it when
          missing, then configures colors, copy, and behavior from the current
          application. After Website import it wires{" "}
          <code className="text-xs">observeNeylonSection</code> on major page
          blocks.
        </p>
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        <li className="rounded-xl border border-[var(--ink)]/15 bg-white p-4">
          <span className="mono text-xs opacity-50">1</span>
          <h3 className="mt-2 font-medium">Create an API key</h3>
          <p className="caption mt-1 text-sm">
            Create or copy a publishable key from Settings.
          </p>
          <Link
            className="btn-ink mt-4 inline-flex bg-white px-3 py-1.5 text-xs"
            href="/dashboard/settings?section=api-keys"
          >
            Create an API key
          </Link>
        </li>
        <li className="rounded-xl border border-[var(--ink)]/15 bg-white p-4">
          <span className="mono text-xs opacity-50">2</span>
          <h3 className="mt-2 font-medium">Copy the instructions</h3>
          <p className="caption mt-1 text-sm">
            Copy the instructions below into your coding agent.
          </p>
        </li>
        <li className="rounded-xl border border-[var(--ink)]/15 bg-white p-4">
          <span className="mono text-xs opacity-50">3</span>
          <h3 className="mt-2 font-medium">Review the result</h3>
          <p className="caption mt-1 text-sm">
            Check the widget against your site on mobile and desktop.
          </p>
        </li>
      </ol>

      <div className="overflow-hidden rounded-xl border border-[var(--ink)]/20 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/10 px-4 py-3">
          <div>
            <h3 className="font-medium">Coding agent instructions</h3>
            <p className="caption text-xs">Paste directly into your agent.</p>
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
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed">
          {WIDGET_CODING_AGENT_SKILL}
        </pre>
      </div>
    </section>
  );
}
