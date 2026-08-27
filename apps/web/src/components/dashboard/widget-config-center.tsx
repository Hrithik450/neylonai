"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { SmoothCollapse } from "@/components/dashboard/smooth-collapse";
import { WidgetStaticPreview } from "@/components/dashboard/widget-static-preview";
import {
  mergeWidgetConfig,
  DEFAULT_THEME_PRESET_ID,
  WIDGET_THEME_PRESETS,
  type StoredWidgetConfig,
  type ThemePreset,
} from "@/lib/widget-config-types";
import {
  WidgetFontControls,
  patchBrandingFont,
} from "@/components/dashboard/widget-font-controls";
import {
  WidgetLogoControls,
  patchBrandingLogoUrl,
} from "@/components/dashboard/widget-logo-controls";

/** One selectable theme card: a mini widget preview built from the preset's own tokens. */
function ThemePresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: ThemePreset;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const c = preset.colors;
  // AI bubble is `transparent` on light themes → show it sitting on the panel.
  const aiBg =
    c.aiMessageBackground === "transparent"
      ? c.gradientTo
      : c.aiMessageBackground;
  return (
    <button
      type="button"
      onClick={() => onSelect(preset.id)}
      aria-pressed={selected}
      className={`group flex cursor-pointer flex-col gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
        selected
          ? "border-[var(--ink)] ring-1 ring-[var(--ink)]"
          : "border-[var(--ink)]/15 hover:border-[var(--ink)]/40"
      }`}
    >
      {/* Mini preview — gradient panel + heading dot, AI + human bubbles, CTA bar */}
      <div
        className="space-y-2 overflow-hidden rounded-lg border p-2.5"
        style={{
          background: `linear-gradient(to bottom, ${c.gradientFrom}, ${c.gradientTo})`,
          borderColor: c.borderColor,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: c.primaryTextBackground }}
          />
          <span
            className="h-1.5 w-14 rounded-full"
            style={{ backgroundColor: c.primaryTextColor, opacity: 0.85 }}
          />
        </div>
        <div
          className="h-4 w-4/5 rounded-md rounded-bl-sm border"
          style={{ backgroundColor: aiBg, borderColor: c.borderColor }}
        />
        <div
          className="ml-auto h-4 w-3/5 rounded-md rounded-br-sm"
          style={{ backgroundColor: c.humanMessageBackground }}
        />
        <div
          className="flex items-center justify-between rounded-md px-2 py-1.5"
          style={{ backgroundColor: c.primaryTextBackground }}
        >
          <span
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: c.askButtonTextColor, opacity: 0.9 }}
          />
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: c.askButtonTextColor }}
          />
        </div>
      </div>

      {/* Label row */}
      <div className="flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">
              {preset.label}
            </span>
            <span className="sticker shrink-0 bg-[var(--cream)] text-[0.5rem] uppercase tracking-wide">
              {preset.group}
            </span>
          </div>
          <p className="caption text-[0.7rem] leading-snug line-clamp-2">
            {preset.description}
          </p>
        </div>
        <span
          aria-hidden
          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[0.6rem] ${
            selected
              ? "border-[var(--ink)] bg-[var(--ink)] text-white"
              : "border-[var(--ink)]/30 text-transparent"
          }`}
        >
          ✓
        </span>
      </div>
    </button>
  );
}

/** Appearance → Theme: pick one of the curated presets (sets every widget color). */
function ThemePresetGallery({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <SectionLabel>Theme</SectionLabel>
        <p className="caption text-xs">
          Pick a curated palette — it sets every widget color at once, including
          true dark themes. Font, logo, name, and layout stay separate.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {WIDGET_THEME_PRESETS.map((preset) => (
          <ThemePresetCard
            key={preset.id}
            preset={preset}
            selected={preset.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[0.65rem] font-bold tracking-[0.12em] uppercase opacity-60">
      {children}
    </span>
  );
}

function ConfigSection({
  title,
  description,
  defaultOpen = false,
  badge,
  id,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  badge?: string;
  id?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="ink-card overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        className="w-full cursor-pointer list-none p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3 select-none text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-medium">{title}</h2>
            {badge ? (
              <span className="sticker text-[0.6rem] bg-[var(--cream)]">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="caption text-sm">{description}</p>
        </div>
        <span className="mono text-[0.65rem] opacity-50 shrink-0">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      <SmoothCollapse open={open}>
        <div className="px-5 sm:px-6 pb-6 space-y-4 border-t border-[var(--ink)]/10 pt-5">
          {children}
        </div>
      </SmoothCollapse>
    </div>
  );
}

function linesFromList(items: string[] | undefined): string {
  return (items ?? []).join("\n");
}

function BehaviorFaqEditor({
  faqs,
  onChangeFaq,
}: {
  faqs: Array<{ question: string; answer: string }>;
  onChangeFaq: (
    index: number,
    next: { question: string; answer: string },
  ) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <FieldLabel>Home FAQs</FieldLabel>
      <div className="space-y-2">
        {faqs.map((faq, idx) => {
          const open = openIndex === idx;
          return (
            <div
              key={`faq-editor-${idx}`}
              className="rounded-lg border border-[var(--ink)]/10 bg-white"
            >
              <button
                type="button"
                aria-expanded={open}
                className="w-full cursor-pointer px-3 py-2.5 flex items-center justify-between gap-2 text-left"
                onClick={() => setOpenIndex(open ? null : idx)}
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-[0.6rem] tracking-[0.14em] uppercase opacity-50 mr-2">
                    FAQ {idx + 1}
                  </span>
                  {faq.question.trim() || "Untitled question"}
                </span>
                <span
                  aria-hidden
                  className={`mono text-[0.65rem] opacity-40 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    open ? "rotate-90" : "rotate-0"
                  }`}
                >
                  ›
                </span>
              </button>
              <SmoothCollapse open={open} durationMs={320}>
                <div className="space-y-2 border-t border-[var(--ink)]/10 px-3 py-3">
                  <label className="block space-y-1">
                    <span className="caption text-xs">Question</span>
                    <input
                      className="ink-input"
                      value={faq.question}
                      placeholder="e.g. What is your pricing?"
                      onChange={(e) =>
                        onChangeFaq(idx, {
                          ...faq,
                          question: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="caption text-xs">Answer</span>
                    <textarea
                      className="ink-input min-h-20"
                      value={faq.answer}
                      placeholder="Short answer shown when expanded…"
                      onChange={(e) =>
                        onChangeFaq(idx, {
                          ...faq,
                          answer: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </SmoothCollapse>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function listFromLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function configsEqual(a: StoredWidgetConfig, b: StoredWidgetConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function WidgetConfigCenter({
  initial,
  planId,
  advancedProactive,
}: {
  initial: StoredWidgetConfig;
  planId: string;
  advancedProactive: boolean;
}) {
  const [saved, setSaved] = useState(() => mergeWidgetConfig(initial));
  const [draft, setDraft] = useState(() => mergeWidgetConfig(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const dirty = !configsEqual(draft, saved);

  const patch = useCallback(
    (updater: (prev: StoredWidgetConfig) => StoredWidgetConfig) => {
      setDraft((prev) => mergeWidgetConfig(updater(prev)));
      setMessage(null);
    },
    [],
  );

  const publish = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/widget-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          config: StoredWidgetConfig;
        };
        error?: string;
      };
      if (!json.success || !json.data?.config) {
        throw new Error(json.error ?? "Publish failed");
      }
      const next = mergeWidgetConfig(json.data.config);
      setSaved(next);
      setDraft(next);
      setMessage(
        "Published. Hard-refresh pages with the Support Widget to load the new config.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(saved);
    setMessage("Discarded unsaved changes.");
  };

  const draftAppearance = useMemo(() => mergeWidgetConfig(draft), [draft]);

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 min-w-0">
          <h1 id="widget-config-heading" className="text-3xl sm:text-4xl">Widget</h1>
          <p className="caption text-sm max-w-2xl">
            Complete chatbot setup: appearance, behavior, proactive suggestions,
            greeting, and launcher.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {dirty ? (
            <span
              className="caption inline-block rounded-full border border-black bg-[var(--yellow)] px-3 py-1 text-sm"
              style={{ color: "#000000" }}
            >
              Unsaved changes
            </span>
          ) : (
            <span
              className="caption inline-block rounded-full border border-black bg-[var(--green)] px-3 py-1 text-sm"
              style={{ color: "#000000" }}
            >
              Published
            </span>
          )}
          <span className="caption text-sm capitalize">{planId} plan</span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        <div className="space-y-4 min-w-0">
          {/* 1. Appearance */}
          <ConfigSection
            id="widget-appearance-section"
            title="Appearance"
            description="Name, logo, panel gradient, Ask button, cards, and tabs."
          >
            <label className="block space-y-1.5">
              <FieldLabel>Chatbot name (optional)</FieldLabel>
              <input
                className="ink-input"
                value={draft.branding?.name ?? ""}
                placeholder="Leave empty if your logo already includes the name"
                onChange={(e) =>
                  patch((f) => ({
                    ...f,
                    branding: { ...f.branding, name: e.target.value },
                  }))
                }
              />
              <p className="caption text-xs">
                Optional when the logo image already contains your brand name.
              </p>
            </label>
            <div className="space-y-1.5">
              <FieldLabel>Logo</FieldLabel>
              <WidgetLogoControls
                logoUrl={draft.branding?.logoUrl}
                onLogoUrlChange={(url) =>
                  patch((f) => patchBrandingLogoUrl(f, url))
                }
              />
            </div>
            <WidgetFontControls
              font={draft.branding?.font}
              onChange={(font) => patch((f) => patchBrandingFont(f, font))}
            />

            <ThemePresetGallery
              selectedId={
                draft.branding?.themePreset ?? DEFAULT_THEME_PRESET_ID
              }
              onSelect={(id) =>
                patch((f) => ({
                  ...f,
                  branding: { ...f.branding, themePreset: id },
                }))
              }
            />
          </ConfigSection>

          {/* 2. Behavior */}
          <ConfigSection
            id="widget-behavior-section"
            title="Behavior"
            description="Greeting, ask card, home FAQs, and talk-to-the-team copy."
          >
            <label className="block space-y-1.5">
              <FieldLabel>Welcome greeting</FieldLabel>
              <input
                className="ink-input"
                value={draft.messages?.welcomeGreeting ?? ""}
                onChange={(e) =>
                  patch((f) => ({
                    ...f,
                    messages: {
                      ...f.messages,
                      welcomeGreeting: e.target.value,
                    },
                  }))
                }
              />
              <p className="caption text-xs">
                Use {"{name}"} for the visitor&apos;s first name (or
                &quot;there&quot;).
              </p>
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Rotating intro lines (one per line)</FieldLabel>
              <textarea
                className="ink-input min-h-28"
                value={linesFromList(draft.messages?.introMessages)}
                onChange={(e) =>
                  patch((f) => ({
                    ...f,
                    messages: {
                      ...f.messages,
                      introMessages: listFromLines(e.target.value),
                    },
                  }))
                }
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <FieldLabel>Ask card title</FieldLabel>
                <input
                  className="ink-input"
                  value={draft.messages?.askTitle ?? ""}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      messages: { ...f.messages, askTitle: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <FieldLabel>Ask card subtitle</FieldLabel>
                <input
                  className="ink-input"
                  value={draft.messages?.askSubtitle ?? ""}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      messages: { ...f.messages, askSubtitle: e.target.value },
                    }))
                  }
                />
              </label>
            </div>

            <BehaviorFaqEditor
              faqs={draft.messages?.faqs ?? []}
              onChangeFaq={(idx, next) =>
                patch((f) => {
                  const faqs = [...(f.messages?.faqs ?? [])];
                  faqs[idx] = next;
                  return {
                    ...f,
                    messages: { ...f.messages, faqs },
                  };
                })
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <FieldLabel>Talk to the team title</FieldLabel>
                <input
                  className="ink-input"
                  value={draft.messages?.feedbackTitle ?? ""}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      messages: {
                        ...f.messages,
                        feedbackTitle: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <FieldLabel>Talk to the team subtitle</FieldLabel>
                <input
                  className="ink-input"
                  value={draft.messages?.feedbackSubtitle ?? ""}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      messages: {
                        ...f.messages,
                        feedbackSubtitle: e.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>
          </ConfigSection>

          {/* 3. Proactive suggestions control */}
          <ConfigSection
            title="Proactive suggestions control"
            description="Bubbles near the launcher before a chat starts, plus the pop sound."
          >
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.proactive?.enabled ?? true}
                onChange={(e) =>
                  patch((f) => ({
                    ...f,
                    proactive: { ...f.proactive, enabled: e.target.checked },
                  }))
                }
              />
              Enable proactive suggestions
            </label>
            <fieldset
              disabled={!advancedProactive}
              className={`grid gap-4 sm:grid-cols-2 ${!advancedProactive ? "opacity-50" : ""}`}
            >
              {(
                [
                  ["initialIdleMs", "First suggestion delay (ms)"],
                  ["displayMs", "Bubble display time (ms)"],
                  ["rotateGapMs", "Cooldown between bubbles (ms)"],
                  ["rotateGapJitterMs", "Random extra cooldown (ms)"],
                  ["postChatDelayMs", "Delay after closing chat (ms)"],
                  ["poolLimit", "Max suggestions per refresh"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block space-y-1.5">
                  <FieldLabel>{label}</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="ink-input"
                    value={draft.proactive?.[key] ?? 0}
                    onChange={(e) =>
                      patch((f) => ({
                        ...f,
                        proactive: {
                          ...f.proactive,
                          [key]: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </fieldset>
            {!advancedProactive ? (
              <p className="caption text-sm">
                Timing controls unlock on Pro with advanced proactive.{" "}
                <Link
                  href="/dashboard/settings?section=billing&upgrade=pro"
                  className="underline underline-offset-4"
                >
                  Upgrade to Pro
                </Link>
              </p>
            ) : (
              <p className="caption text-sm">
                Suggestions stay page- and conversation-aware via the Neylon AI
                suggestions API — content is generated server-side from the
                visitor&apos;s path and recent messages.
              </p>
            )}

            <div className="space-y-4 border-t border-[var(--ink)]/10 pt-4">
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={draft.proactive?.soundEnabled ?? true}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      proactive: {
                        ...f.proactive,
                        soundEnabled: e.target.checked,
                      },
                    }))
                  }
                />
                Play suggestion sound
              </label>
              <label className="block space-y-1.5">
                <FieldLabel>
                  Volume ({Math.round((draft.proactive?.volume ?? 0.22) * 100)}
                  %)
                </FieldLabel>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((draft.proactive?.volume ?? 0.22) * 100)}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      proactive: {
                        ...f.proactive,
                        volume: Number(e.target.value) / 100,
                      },
                    }))
                  }
                  className="w-full"
                />
              </label>
            </div>
          </ConfigSection>

          {/* 4. Launcher */}
          <ConfigSection
            title="Launcher"
            description="Corner, size, spacing, and visibility."
          >
            <fieldset className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Position</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["bottom-right", "Bottom right"],
                      ["bottom-left", "Bottom left"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`btn-ink px-3 py-1.5 text-xs ${
                        draft.layout?.position === value
                          ? "bg-[var(--ink)] text-white"
                          : "bg-white"
                      }`}
                      onClick={() =>
                        patch((f) => ({
                          ...f,
                          layout: { ...f.layout, position: value },
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Launcher size</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {(["sm", "md", "lg"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`btn-ink px-3 py-1.5 text-xs uppercase ${
                        draft.layout?.launcherSize === size
                          ? "bg-[var(--ink)] text-white"
                          : "bg-white"
                      }`}
                      onClick={() =>
                        patch((f) => ({
                          ...f,
                          layout: { ...f.layout, launcherSize: size },
                        }))
                      }
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel>Edge spacing X (px)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    max={96}
                    className="ink-input"
                    value={draft.layout?.offsetX ?? 24}
                    onChange={(e) =>
                      patch((f) => ({                        ...f,
                        layout: {
                          ...f.layout,
                          offsetX: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel>Edge spacing Y (px)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    max={96}
                    className="ink-input"
                    value={draft.layout?.offsetY ?? 12}
                    onChange={(e) =>
                      patch((f) => ({
                        ...f,
                        layout: {
                          ...f.layout,
                          offsetY: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={draft.layout?.launcherVisible ?? true}
                  onChange={(e) =>
                    patch((f) => ({
                      ...f,
                      layout: {
                        ...f.layout,
                        launcherVisible: e.target.checked,
                      },
                    }))
                  }
                />
                Show launcher button
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={draft.defaultOpen ?? false}
                  onChange={(e) =>
                    patch((f) => ({ ...f, defaultOpen: e.target.checked }))
                  }
                />
                Auto-open widget on page load
              </label>
            </fieldset>
          </ConfigSection>
        </div>

        {/* Static appearance preview */}
        <aside className="xl:sticky xl:top-6 h-fit min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SectionLabel>Preview</SectionLabel>
            </div>
            <button
              type="button"
              className="btn-ink bg-white px-3 py-1.5 text-xs"
              onClick={() => setPreviewOpen((o) => !o)}
            >
              {previewOpen ? "Close panel" : "Open panel"}
            </button>
          </div>
          <div className="ink-card relative isolate min-w-0 overflow-hidden bg-[linear-gradient(160deg,#e8efe9_0%,#f7f3ea_55%,#efe8dc_100%)] h-[min(78vh,820px)] min-h-[560px]">
            <div className="absolute inset-0 pointer-events-none opacity-30 [background-image:radial-gradient(circle_at_1px_1px,var(--ink)_1px,transparent_0)] [background-size:18px_18px]" />
            <div className="relative h-full min-h-0 min-w-0 overflow-hidden p-2">
              <WidgetStaticPreview
                appearance={draftAppearance}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky publish bar */}
      <div id="widget-publish-bar" className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--ink)] bg-[var(--cream)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <p className="caption text-sm">
            {dirty ? "You have unsaved changes." : "All changes are published."}
            {message ? (
              <span className="ml-2 opacity-80">{message}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={discard}
              className="btn-ink bg-white px-4 py-2 text-sm disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void publish()}
              className="btn-ink bg-[var(--blue)] text-white px-5 py-2 text-sm disabled:opacity-40"
            >
              {saving ? "Publishing…" : "Save / Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
