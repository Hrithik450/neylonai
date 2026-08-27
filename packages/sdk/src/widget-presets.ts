/**
 * Curated widget theme presets — the ONLY way a workspace themes its widget.
 *
 * Per-field color customization has been removed in favour of a small set of
 * hand-tuned, accessible palettes. A preset supplies every color token at once;
 * `mergeBranding` resolves the selected preset and lets it win over any stored
 * per-field colors, so picking a preset fully replaces the palette.
 *
 * This module is a LEAF: it must not import from `widget-config.ts` (that file
 * imports from here). Keep it dependency-free so the import graph stays acyclic.
 */

/** Every color token a preset controls. Mirrors the branding color fields. */
export interface ThemePresetColors {
  /** Heading / emphasis text + header chrome icons. */
  primaryTextColor: string;
  /** Body / muted text. */
  secondaryTextColor: string;
  /** Inactive tabs, equalizer bars, audio visualizer. */
  accentColor: string;
  /** Active tab + markdown links. */
  tabActiveColor: string;
  /** Panel gradient top (also the nav/header fill). */
  gradientFrom: string;
  /** Panel gradient bottom. */
  gradientTo: string;
  /** Ask CTA / launcher / avatar circle / threads FAB fill. */
  primaryTextBackground: string;
  /** Text/icon color on `primaryTextBackground`. */
  askButtonTextColor: string;
  /** FAQ / suggestion card fill. */
  secondaryTextBackground: string;
  /** AI bubble fill (`transparent` sits on the panel; solid for dark themes). */
  aiMessageBackground: string;
  /** Human bubble fill. */
  humanMessageBackground: string;
  /** Neutral elevated surface: composer, inputs, FAB, mic, pucks, banners. */
  surfaceColor: string;
  /** Every hairline border. */
  borderColor: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  group: "light" | "dark";
  colors: ThemePresetColors;
}

export const DEFAULT_THEME_PRESET_ID = "evergreen";

/**
 * The 6 presets. `evergreen` reproduces the historical default palette exactly,
 * so existing widgets look unchanged until a workspace picks another theme.
 * `midnight` / `obsidian` are genuine dark themes: solid (non-transparent)
 * bubble fills and a light `primaryTextColor` so header icons read on the panel.
 */
export const WIDGET_THEME_PRESETS: ThemePreset[] = [
  {
    id: "evergreen",
    label: "Evergreen",
    description: "Calm forest green — the classic Neylon look.",
    group: "light",
    colors: {
      primaryTextColor: "#0E3228",
      secondaryTextColor: "rgba(0, 0, 0, 0.7)",
      accentColor: "#71717a",
      tabActiveColor: "#0E3228",
      gradientFrom: "rgb(144, 238, 144)",
      gradientTo: "#ffffff",
      primaryTextBackground: "#0E3228",
      askButtonTextColor: "#ffffff",
      secondaryTextBackground: "#ffffff",
      aiMessageBackground: "transparent",
      humanMessageBackground: "#e4e4e7",
      surfaceColor: "#ffffff",
      borderColor: "rgba(0, 0, 0, 0.1)",
    },
  },
  {
    id: "azure",
    label: "Azure",
    description: "Professional blue for a clean, trustworthy SaaS feel.",
    group: "light",
    colors: {
      primaryTextColor: "#0B2447",
      secondaryTextColor: "rgba(11, 36, 71, 0.65)",
      accentColor: "#2563eb",
      tabActiveColor: "#2563eb",
      gradientFrom: "#dbeafe",
      gradientTo: "#ffffff",
      primaryTextBackground: "#2563eb",
      askButtonTextColor: "#ffffff",
      secondaryTextBackground: "#ffffff",
      aiMessageBackground: "transparent",
      humanMessageBackground: "#dbeafe",
      surfaceColor: "#ffffff",
      borderColor: "rgba(37, 99, 235, 0.15)",
    },
  },
  {
    id: "iris",
    label: "Iris",
    description: "Modern violet with a premium, focused mood.",
    group: "light",
    colors: {
      primaryTextColor: "#2E1065",
      secondaryTextColor: "rgba(46, 16, 101, 0.65)",
      accentColor: "#7c3aed",
      tabActiveColor: "#7c3aed",
      gradientFrom: "#ede9fe",
      gradientTo: "#ffffff",
      primaryTextBackground: "#7c3aed",
      askButtonTextColor: "#ffffff",
      secondaryTextBackground: "#ffffff",
      aiMessageBackground: "transparent",
      humanMessageBackground: "#ede9fe",
      surfaceColor: "#ffffff",
      borderColor: "rgba(124, 58, 237, 0.15)",
    },
  },
  {
    id: "coral",
    label: "Coral",
    description: "Warm terracotta — friendly and inviting.",
    group: "light",
    colors: {
      primaryTextColor: "#4C1D12",
      secondaryTextColor: "rgba(76, 29, 18, 0.66)",
      accentColor: "#C2410C",
      tabActiveColor: "#C2410C",
      gradientFrom: "#FDEAE0",
      gradientTo: "#ffffff",
      primaryTextBackground: "#C2410C",
      askButtonTextColor: "#ffffff",
      secondaryTextBackground: "#ffffff",
      aiMessageBackground: "transparent",
      humanMessageBackground: "#FBE1D6",
      surfaceColor: "#ffffff",
      borderColor: "rgba(194, 65, 12, 0.15)",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Neutral near-black dark mode with an inverted light CTA.",
    group: "dark",
    colors: {
      primaryTextColor: "#F4F4F5",
      secondaryTextColor: "rgba(244, 244, 245, 0.65)",
      accentColor: "#a1a1aa",
      tabActiveColor: "#ffffff",
      gradientFrom: "#18181B",
      gradientTo: "#0A0A0B",
      primaryTextBackground: "#F4F4F5",
      askButtonTextColor: "#18181B",
      secondaryTextBackground: "#111113",
      aiMessageBackground: "#1C1C1F",
      humanMessageBackground: "#2A2A2E",
      surfaceColor: "#1C1C1F",
      borderColor: "rgba(255, 255, 255, 0.12)",
    },
  },
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Deep indigo dark mode with a vivid brand CTA.",
    group: "dark",
    colors: {
      primaryTextColor: "#E8EAF2",
      secondaryTextColor: "rgba(232, 234, 242, 0.65)",
      accentColor: "#818cf8",
      tabActiveColor: "#818cf8",
      gradientFrom: "#1E1B3A",
      gradientTo: "#12101F",
      primaryTextBackground: "#6366F1",
      askButtonTextColor: "#ffffff",
      secondaryTextBackground: "#16132A",
      aiMessageBackground: "#211E3D",
      humanMessageBackground: "#312E52",
      surfaceColor: "#211E3D",
      borderColor: "rgba(129, 140, 248, 0.18)",
    },
  },
];

const PRESETS_BY_ID: Record<string, ThemePreset> = Object.fromEntries(
  WIDGET_THEME_PRESETS.map((preset) => [preset.id, preset]),
);

/** Resolve a preset id to its definition, falling back to the default. */
export function resolveThemePreset(id?: string | null): ThemePreset {
  const key = id?.trim();
  return (
    (key && PRESETS_BY_ID[key]) ||
    PRESETS_BY_ID[DEFAULT_THEME_PRESET_ID] ||
    WIDGET_THEME_PRESETS[0]
  );
}
