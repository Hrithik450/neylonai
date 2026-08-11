"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { SmoothCollapse } from "@/components/dashboard/smooth-collapse";
import { WidgetStaticPreview } from "@/components/dashboard/widget-static-preview";
import {
  mergeWidgetConfig,
  DEFAULT_WIDGET_CONFIG,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";
import {
  WidgetFontControls,
  patchBrandingFont,
} from "@/components/dashboard/widget-font-controls";
import {
  WidgetLogoControls,
  patchBrandingLogoUrl,
} from "@/components/dashboard/widget-logo-controls";

/** Platform default color palette (Appearance → Colors). */
type WidgetColorPalette = {
  gradientFrom: string;
  gradientTo: string;
  headerTint: string;
  primaryTextColor: string;
  primaryColor: string;
  secondaryTextColor: string;
  primaryTextBackground: string;
  askButtonTextColor: string;
  secondaryTextBackground: string;
  tabActiveColor: string;
  accentColor: string;
  aiMessageBackground: string;
  humanMessageBackground: string;
};

function platformColorPalette(): WidgetColorPalette {
  const d = DEFAULT_WIDGET_CONFIG.branding!;
  return {
    gradientFrom: d.gradientFrom!,
    gradientTo: d.gradientTo!,
    headerTint: d.headerTint ?? d.gradientFrom!,
    primaryTextColor: d.primaryTextColor!,
    primaryColor: d.primaryColor ?? d.primaryTextColor!,
    secondaryTextColor: d.secondaryTextColor!,
    primaryTextBackground: d.primaryTextBackground!,
    askButtonTextColor: d.askButtonTextColor!,
    secondaryTextBackground: d.secondaryTextBackground!,
    tabActiveColor: d.tabActiveColor!,
    accentColor: d.accentColor!,
    aiMessageBackground: d.aiMessageBackground!,
    humanMessageBackground: d.humanMessageBackground!,
  };
}

function pickColorPalette(
  branding: StoredWidgetConfig["branding"],
): WidgetColorPalette {
  const platform = platformColorPalette();
  return {
    gradientFrom:
      branding?.gradientFrom ?? branding?.headerTint ?? platform.gradientFrom,
    gradientTo: branding?.gradientTo ?? platform.gradientTo,
    headerTint:
      branding?.headerTint ?? branding?.gradientFrom ?? platform.headerTint,
    primaryTextColor:
      branding?.primaryTextColor ??
      branding?.primaryColor ??
      platform.primaryTextColor,
    primaryColor:
      branding?.primaryColor ??
      branding?.primaryTextColor ??
      platform.primaryColor,
    secondaryTextColor:
      branding?.secondaryTextColor ?? platform.secondaryTextColor,
    primaryTextBackground:
      branding?.primaryTextBackground ?? platform.primaryTextBackground,
    askButtonTextColor:
      branding?.askButtonTextColor ?? platform.askButtonTextColor,
    secondaryTextBackground:
      branding?.secondaryTextBackground ?? platform.secondaryTextBackground,
    tabActiveColor: branding?.tabActiveColor ?? platform.tabActiveColor,
    accentColor: branding?.accentColor ?? platform.accentColor,
    aiMessageBackground:
      branding?.aiMessageBackground ?? platform.aiMessageBackground,
    humanMessageBackground:
      branding?.humanMessageBackground ?? platform.humanMessageBackground,
  };
}

function colorPalettesEqual(a: WidgetColorPalette, b: WidgetColorPalette) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mono block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mono text-[0.65rem] font-bold tracking-[0.12em] uppercase opacity-60">
      {children}
    </span>
  );
}

function ConfigSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="ink-card overflow-hidden">
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
  onChangeFaq: (index: number, next: { question: string; answer: string }) => void;
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
                  <span className="mono text-[0.6rem] tracking-[0.14em] uppercase opacity-50 mr-2">
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

/** Round native color picker swatch. */
const COLOR_SWATCH_CLASS =
  "h-10 w-10 shrink-0 cursor-pointer appearance-none rounded-full border border-[var(--ink)] bg-transparent p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0";

/** Normalize css colors for `<input type="color">` (needs #rrggbb). */
function toColorInputValue(raw: string): string {
  const v = raw.trim();
  if (!v || /^transparent$/i.test(v)) return "#ffffff";
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1]!;
    const g = v[2]!;
    const b = v[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const rgb = v.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (rgb) {
    const hex = (n: string) =>
      Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
    return `#${hex(rgb[1]!)}${hex(rgb[2]!)}${hex(rgb[3]!)}`;
  }
  return "#000000";
}

export function WidgetConfigCenter({
  initial,
  planId,
  fullWidgetCustomization,
  advancedProactive,
}: {
  initial: StoredWidgetConfig;
  planId: string;
  fullWidgetCustomization: boolean;
  advancedProactive: boolean;
}) {
  const [saved, setSaved] = useState(() => mergeWidgetConfig(initial));
  const [draft, setDraft] = useState(() => mergeWidgetConfig(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const dirty = !configsEqual(draft, saved);
  const draftColors = useMemo(
    () => pickColorPalette(draft.branding),
    [draft.branding],
  );
  const colorsMatchPlatform = colorPalettesEqual(
    draftColors,
    platformColorPalette(),
  );

  const patch = useCallback(
    (updater: (prev: StoredWidgetConfig) => StoredWidgetConfig) => {
      setDraft((prev) => mergeWidgetConfig(updater(prev)));
      setMessage(null);
    },
    [],
  );

  const resetColors = useCallback(() => {
    const platform = platformColorPalette();
    setDraft((prev) =>
      mergeWidgetConfig({
        ...prev,
        branding: {
          ...prev.branding,
          ...platform,
          colorsVersion: 1,
        },
      }),
    );
    setMessage(null);
  }, []);

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

  const draftAppearance = useMemo(
    () =>
      mergeWidgetConfig({
        ...draft,
        branding: {
          ...draft.branding,
          gradientFrom:
            draft.branding?.gradientFrom ?? draft.branding?.headerTint,
          gradientTo: draft.branding?.gradientTo,
          primaryTextColor:
            draft.branding?.primaryTextColor ?? draft.branding?.primaryColor,
          secondaryTextColor: draft.branding?.secondaryTextColor,
          tabActiveColor: draft.branding?.tabActiveColor,
          accentColor: draft.branding?.accentColor,
          primaryTextBackground:
            draft.branding?.primaryTextBackground ??
            draft.branding?.primaryTextColor ??
            draft.branding?.primaryColor,
          askButtonTextColor:
            draft.branding?.askButtonTextColor ?? "#ffffff",
          secondaryTextBackground: draft.branding?.secondaryTextBackground,
          aiMessageBackground: draft.branding?.aiMessageBackground,
          humanMessageBackground: draft.branding?.humanMessageBackground,
          primaryColor:
            draft.branding?.primaryTextColor ?? draft.branding?.primaryColor,
          headerTint:
            draft.branding?.gradientFrom ?? draft.branding?.headerTint,
        },
      }),
    [draft],
  );

  const advancedLocked = !fullWidgetCustomization;

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 min-w-0">
          <h1 className="text-3xl sm:text-4xl">Widget</h1>
          <p className="caption text-sm max-w-2xl">
            Complete chatbot setup — appearance, behavior, proactive suggestions,
            appearance, greeting, and launcher. Preview updates as you edit;
            publish when you&apos;re ready.
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

      {advancedLocked ? (
        <UpgradePrompt
          compact
          title="Full widget customization is on Starter+"
          detail="You can edit core branding and messages on Free. Unlock layout, theme accents, tabs, path targeting, and timing on Starter."
          ctaLabel="Upgrade to Starter"
          href="/dashboard/settings?section=billing&upgrade=starter"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        <div className="space-y-4 min-w-0">
          {/* 1. Appearance */}
          <ConfigSection
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionLabel>Colors</SectionLabel>
                <button
                  type="button"
                  className="btn-ink bg-white px-3 py-1.5 text-xs disabled:opacity-40"
                  disabled={colorsMatchPlatform}
                  onClick={resetColors}
                  title="Restore the Neylon platform color palette"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel>Gradient top</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={
                        toColorInputValue(
                          draft.branding?.gradientFrom ??
                            draft.branding?.headerTint ??
                            "#90ee90",
                        )
                      }
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            gradientFrom: e.target.value,
                            headerTint: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={
                        draft.branding?.gradientFrom ??
                        draft.branding?.headerTint ??
                        ""
                      }
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            gradientFrom: e.target.value,
                            headerTint: e.target.value,
                          },
                        }))
                      }
                      placeholder="rgb(144, 238, 144)"
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel>Gradient bottom</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.gradientTo ?? "#ffffff",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            gradientTo: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.gradientTo ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            gradientTo: e.target.value,
                          },
                        }))
                      }
                      placeholder="#ffffff"
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel>Heading</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.primaryTextColor ??
                          draft.branding?.primaryColor ??
                          "#0E3228",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            primaryTextColor: e.target.value,
                            primaryColor: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={
                        draft.branding?.primaryTextColor ??
                        draft.branding?.primaryColor ??
                        ""
                      }
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            primaryTextColor: e.target.value,
                            primaryColor: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel>Body</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.secondaryTextColor ?? "#000000",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            secondaryTextColor: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.secondaryTextColor ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            secondaryTextColor: e.target.value,
                          },
                        }))
                      }
                      placeholder="rgba(0, 0, 0, 0.7)"
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel>Ask button background</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.primaryTextBackground ??
                          draft.branding?.primaryTextColor ??
                          draft.branding?.primaryColor ??
                          "#0E3228",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            primaryTextBackground: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.primaryTextBackground ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            primaryTextBackground: e.target.value,
                          },
                        }))
                      }
                      placeholder="#0E3228"
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel>Ask button text</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.askButtonTextColor ?? "#ffffff",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            askButtonTextColor: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.askButtonTextColor ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            askButtonTextColor: e.target.value,
                          },
                        }))
                      }
                      placeholder="#ffffff"
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel>Tab active</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.tabActiveColor ?? "#7c3aed",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            tabActiveColor: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.tabActiveColor ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            tabActiveColor: e.target.value,
                          },
                        }))
                      }
                      placeholder="#7c3aed"
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel>Tab inactive</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.accentColor ?? "#71717a",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            accentColor: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.accentColor ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            accentColor: e.target.value,
                          },
                        }))
                      }
                      placeholder="#71717a"
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel>AI message</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.aiMessageBackground ?? "transparent",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            aiMessageBackground: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.aiMessageBackground ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            aiMessageBackground: e.target.value,
                          },
                        }))
                      }
                      placeholder="transparent"
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel>Human message</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className={COLOR_SWATCH_CLASS}
                      value={toColorInputValue(
                        draft.branding?.humanMessageBackground ?? "#e4e4e7",
                      )}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            humanMessageBackground: e.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="ink-input flex-1"
                      value={draft.branding?.humanMessageBackground ?? ""}
                      onChange={(e) =>
                        patch((f) => ({
                          ...f,
                          branding: {
                            ...f.branding,
                            humanMessageBackground: e.target.value,
                          },
                        }))
                      }
                      placeholder="#e4e4e7"
                    />
                  </div>
                </label>
              </div>

              <label className="block space-y-1.5 max-w-md">
                <FieldLabel>Card background</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className={COLOR_SWATCH_CLASS}
                    value={toColorInputValue(
                      draft.branding?.secondaryTextBackground ?? "#ffffff",
                    )}
                    onChange={(e) =>
                      patch((f) => ({
                        ...f,
                        branding: {
                          ...f.branding,
                          secondaryTextBackground: e.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="ink-input flex-1"
                    value={draft.branding?.secondaryTextBackground ?? ""}
                    onChange={(e) =>
                      patch((f) => ({
                        ...f,
                        branding: {
                          ...f.branding,
                          secondaryTextBackground: e.target.value,
                        },
                      }))
                    }
                    placeholder="#ffffff"
                  />
                </div>
              </label>
            </div>

            <WidgetFontControls
              font={draft.branding?.font}
              onChange={(font) => patch((f) => patchBrandingFont(f, font))}
            />
          </ConfigSection>

          {/* 2. Behavior */}
          <ConfigSection
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
              <label
                className={`block space-y-1.5 ${advancedLocked ? "opacity-50" : ""}`}
              >
                <FieldLabel>
                  Volume ({Math.round((draft.proactive?.volume ?? 0.22) * 100)}%)
                </FieldLabel>
                <input
                  type="range"
                  min={0}
                  max={100}
                  disabled={advancedLocked}
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
            badge={advancedLocked ? "Starter+" : undefined}
          >
            <fieldset
              disabled={advancedLocked}
              className={`space-y-4 ${advancedLocked ? "opacity-50" : ""}`}
            >
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
                      patch((f) => ({
                        ...f,
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
          <div
            className="ink-card relative isolate min-w-0 overflow-hidden bg-[linear-gradient(160deg,#e8efe9_0%,#f7f3ea_55%,#efe8dc_100%)] h-[min(78vh,820px)] min-h-[560px]"
          >
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
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--ink)] bg-[var(--cream)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <p className="caption text-sm">
            {dirty
              ? "You have unsaved changes."
              : "All changes are published."}
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
