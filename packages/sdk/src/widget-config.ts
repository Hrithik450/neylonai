/**
 * Org-stored / remotely fetched widget appearance config.
 * Runtime-only fields (apiKey, user, pagePath) stay on SupportWidgetConfig.
 */
import { tryGetAuthHeaders } from "./runtime-config";
import { apiUrl } from "./network";
import { DEFAULT_WIDGET_FONT } from "./font-catalog";
import {
  DEFAULT_THEME_PRESET_ID,
  resolveThemePreset,
} from "./widget-presets";

export type WidgetFontConfig = {
  /** system | catalog | custom */
  source?: "system" | "catalog" | "custom";
  /** CSS font-family name used by the widget */
  family?: string;
  /** Catalog id when source=system|catalog (e.g. "inter", "system") */
  catalogId?: string;
  /** Google Fonts CSS URL when needed */
  cssUrl?: string;
  /** organization_fonts.id when source=custom */
  customFontId?: string;
  /** Public file URL for custom @font-face src */
  customFontUrl?: string;
  /** Optional site URL used for font detection suggestions */
  websiteUrl?: string;
};

export type StoredWidgetConfig = {
  branding?: {
    name?: string;
    logoUrl?: string;
    /** Heading / emphasis text on the panel and cards. */
    primaryTextColor?: string;
    /** Body / muted text on the panel and cards. */
    secondaryTextColor?: string;
    /** Inactive / unselected tab icon and label. */
    accentColor?: string;
    /** Selected tab icon and label. */
    tabActiveColor?: string;
    /**
     * Bumped when platform color defaults / roles change.
     * Missing or stale → migrate color fields to current defaults on load.
     */
    colorsVersion?: number;
    /** Top color of `linear-gradient(to bottom, …)`. */
    gradientFrom?: string;
    /** Bottom color of the same gradient (structure unchanged). */
    gradientTo?: string;
    /** Ask-a-question CTA (and launcher) fill. */
    primaryTextBackground?: string;
    /** Text/icon color on the Ask CTA and launcher. */
    askButtonTextColor?: string;
    /** FAQ rows, suggestion chips, and similar card surfaces. */
    secondaryTextBackground?: string;
    /** AI / assistant chat bubble fill (foreground auto-contrasts). */
    aiMessageBackground?: string;
    /** Human / visitor chat bubble fill (foreground auto-contrasts). */
    humanMessageBackground?: string;
    /** Selected theme preset id (see `widget-presets`). Resolves the palette. */
    themePreset?: string;
    /** Neutral elevated surface: composer, inputs, FAB, mic, pucks, banners. */
    surfaceColor?: string;
    /** Every hairline border. */
    borderColor?: string;
    tagline?: string;
    /** Widget typography — neutral by default (not Neylon marketing fonts). */
    font?: WidgetFontConfig;
  };
  layout?: {
    position?: "bottom-right" | "bottom-left";
    launcherSize?: "sm" | "md" | "lg";
    offsetX?: number;
    offsetY?: number;
    launcherVisible?: boolean;
  };
  messages?: {
    welcomeGreeting?: string;
    introMessages?: string[];
    inputPlaceholder?: string;
    suggestedQuestions?: string[];
    askTitle?: string;
    askSubtitle?: string;
    feedbackTitle?: string;
    feedbackSubtitle?: string;
    /** Home accordion FAQs. Max 4 used in the widget. */
    faqs?: Array<{ question: string; answer: string }>;
    /**
     * One-way lock: once true, FAQs stay in widget config only.
     * Before that, server may seed once from org knowledge.
     */
    faqsInitialized?: boolean;
    /**
     * One-way lock: once true, the whole messages block is user-owned.
     * Set when the widget content is first AI-seeded from the crawl, or on the
     * first dashboard publish — after that, no automatic re-seed ever runs.
     */
    contentInitialized?: boolean;
  };
  features?: {
    homeTab?: boolean;
    messagesTab?: boolean;
    contactTab?: boolean;
    /** Mic → AI speech-to-text in the message composer. Default true. */
    voiceInput?: boolean;
  };
  website?: {
    visiblePathPrefixes?: string[];
    hiddenPathPrefixes?: string[];
    autoOpenPathPrefixes?: string[];
  };
  proactive?: {
    enabled?: boolean;
    soundEnabled?: boolean;
    volume?: number;
    initialIdleMs?: number;
    displayMs?: number;
    rotateGapMs?: number;
    /** Random extra delay added to `rotateGapMs` (default 2000). */
    rotateGapJitterMs?: number;
    postChatDelayMs?: number;
    poolLimit?: number;
    behavioralTriggers?: {
      scrollDepth?: {
        enabled?: boolean;
        /** 0–100, default 60 */
        thresholdPercent?: number;
        cooldownMs?: number;
      };
      dwell?: {
        enabled?: boolean;
        /** Default 45s */
        thresholdMs?: number;
        cooldownMs?: number;
      };
      exitIntent?: {
        enabled?: boolean;
        cooldownMs?: number;
      };
    };
  };
  defaultOpen?: boolean;
};

/**
 * Define code-owned widget customization with full type checking.
 * Values passed through `SupportWidget.config.customization` override dashboard
 * values (except branding, which is managed via the dashboard).
 */
export function defineWidgetCustomization(
  customization: Omit<StoredWidgetConfig, "branding">,
): Omit<StoredWidgetConfig, "branding"> {
  return customization;
}

/** Defaults shared by remote config + React widget. */
export const DEFAULT_WIDGET_MESSAGES = {
  welcomeGreeting: "Hi {name} 👋",
  introMessages: [
    "Get instant answers from our knowledge.",
    "Ask anything, we escalate when a person is needed.",
    "Skip the wait. Start with a quick question.",
  ],
  inputPlaceholder: "Ask a question…",
  suggestedQuestions: [
    "What can you help me with?",
    "How do I get started?",
    "What are your pricing options?",
    "How do I contact support?",
  ],
  askTitle: "Ask a question",
  askSubtitle: "Instant answers from our knowledge",
  /** Home “Talk to the team” card. */
  feedbackTitle: "Talk to the team",
  feedbackSubtitle: "We escalate with full context when AI can't resolve it",
  faqs: [
    {
      question: "What can this assistant help with?",
      answer:
        "Product questions, how-to guidance, and next steps — answered from your knowledge base in seconds.",
    },
    {
      question: "How do I get started?",
      answer:
        "Type a question below or pick a suggestion. You can keep chatting in this thread anytime.",
    },
    {
      question: "How do I talk to a real person?",
      answer:
        "Use Talk to the team on Home. We’ll escalate with the conversation context so you don’t repeat yourself.",
    },
    {
      question: "Is my conversation private?",
      answer:
        "Chats stay with your workspace. Only your team can review them for support and improvement.",
    },
  ] as Array<{ question: string; answer: string }>,
} as const;

export const DEFAULT_WIDGET_LAYOUT = {
  position: "bottom-right" as const,
  launcherSize: "md" as const,
  offsetX: 24,
  offsetY: 12,
  launcherVisible: true,
};

export const DEFAULT_WIDGET_FEATURES = {
  homeTab: true,
  messagesTab: true,
  contactTab: false,
  voiceInput: true,
};

const DEFAULT_BRANDING = {
  name: "",
  logoUrl: "",
  // Color tokens come from the default (Evergreen) preset — single source of
  // truth. Values are identical to the historical defaults, so nothing shifts.
  ...resolveThemePreset(DEFAULT_THEME_PRESET_ID).colors,
  themePreset: DEFAULT_THEME_PRESET_ID,
  tagline: "AI assistants for modern businesses",
  font: { ...DEFAULT_WIDGET_FONT },
};

const DEFAULT_PROACTIVE = {
  enabled: true,
  soundEnabled: true,
  volume: 0.22,
  initialIdleMs: 800,
  displayMs: 8_000,
  rotateGapMs: 10_000,
  rotateGapJitterMs: 2_000,
  postChatDelayMs: 2_000,
  poolLimit: 5,
  behavioralTriggers: {
    scrollDepth: { enabled: true, thresholdPercent: 60, cooldownMs: 1_800_000 },
    dwell: { enabled: true, thresholdMs: 45_000, cooldownMs: 1_800_000 },
    exitIntent: { enabled: true, cooldownMs: 1_800_000 },
  },
};

export const DEFAULT_WIDGET_CONFIG: StoredWidgetConfig = {
  branding: DEFAULT_BRANDING,
  layout: { ...DEFAULT_WIDGET_LAYOUT },
  messages: {
    ...DEFAULT_WIDGET_MESSAGES,
    introMessages: [...DEFAULT_WIDGET_MESSAGES.introMessages],
    suggestedQuestions: [...DEFAULT_WIDGET_MESSAGES.suggestedQuestions],
    faqs: [...DEFAULT_WIDGET_MESSAGES.faqs],
  },
  features: { ...DEFAULT_WIDGET_FEATURES },
  website: {
    visiblePathPrefixes: [],
    hiddenPathPrefixes: [],
    autoOpenPathPrefixes: [],
  },
  proactive: DEFAULT_PROACTIVE,
  defaultOpen: false,
};

/** Platform branding color schema version (bump when default roles/values change). */
export const BRANDING_COLORS_VERSION = 2;

/**
 * Reset a stored config to the default theme preset, keeping identity fields
 * (name / logo / font / tagline). Used for one-time load migration: it strips
 * any legacy per-field custom colors so the palette is preset-driven from now
 * on (the product no longer supports custom individual colors).
 */
export function withPlatformBrandingColors(
  config: StoredWidgetConfig,
): StoredWidgetConfig {
  const b = config.branding ?? {};
  return {
    ...config,
    branding: {
      // Keep only identity — legacy color fields are intentionally dropped.
      name: b.name,
      logoUrl: b.logoUrl,
      tagline: b.tagline,
      font: b.font,
      themePreset: DEFAULT_THEME_PRESET_ID,
      colorsVersion: BRANDING_COLORS_VERSION,
    },
  };
}

export function brandingColorsNeedMigration(
  stored?: StoredWidgetConfig | null,
): boolean {
  return (stored?.branding?.colorsVersion ?? 0) < BRANDING_COLORS_VERSION;
}

/** Deep-merge stored config onto defaults (org row may be partial). */
const trimOr = (val: string | undefined, fallback: string) =>
  val?.trim() || fallback;

const mergeBranding = (stored: any) => {
  const def = DEFAULT_WIDGET_CONFIG.branding!;
  const s = stored ?? {};
  const preset = resolveThemePreset(s.themePreset);
  return {
    ...def,
    ...s,
    // The selected preset owns every color token and wins over any stored
    // per-field colors — this is what strips legacy custom palettes.
    ...preset.colors,
    themePreset: preset.id,
    // Identity fields still come from stored config.
    name: trimOr(s.name, def.name ?? ""),
    logoUrl: trimOr(s.logoUrl, def.logoUrl ?? ""),
    tagline: trimOr(s.tagline, def.tagline ?? ""),
    font: { ...DEFAULT_WIDGET_FONT, ...def.font, ...s.font },
    colorsVersion: BRANDING_COLORS_VERSION,
  };
};

const cleanFaqs = (faqs: any) => {
  const raw = Array.isArray(faqs) ? faqs : [];
  const cleaned = raw
    .map((f) => ({
      question: f?.question?.trim() || "",
      answer: f?.answer?.trim() || "",
    }))
    .filter((f) => f.question && f.answer)
    .slice(0, 4);
  return cleaned.length ? cleaned : [...DEFAULT_WIDGET_CONFIG.messages!.faqs!];
};

export function mergeWidgetConfig(
  stored?: StoredWidgetConfig | null,
): StoredWidgetConfig {
  const s = stored ?? {};
  const sb = s.branding ?? {};
  const sm = s.messages ?? {};
  const def = DEFAULT_WIDGET_CONFIG;

  const feedbackTitle = sm.feedbackTitle?.trim();
  const feedbackSubtitle = sm.feedbackSubtitle?.trim();

  return {
    ...def,
    ...s,
    branding: mergeBranding(sb),
    layout: { ...def.layout, ...s.layout },
    messages: {
      ...def.messages,
      ...sm,
      introMessages: sm.introMessages?.length
        ? sm.introMessages
        : def.messages?.introMessages,
      suggestedQuestions: sm.suggestedQuestions?.length
        ? sm.suggestedQuestions
        : def.messages?.suggestedQuestions,
      faqs: cleanFaqs(sm.faqs),
      faqsInitialized: sm.faqsInitialized === true,
      contentInitialized: sm.contentInitialized === true,
      feedbackTitle:
        !feedbackTitle || feedbackTitle === "Share Your Feedback"
          ? def.messages?.feedbackTitle
          : feedbackTitle,
      feedbackSubtitle:
        !feedbackSubtitle ||
        feedbackSubtitle === "Help us improve with your feedback."
          ? def.messages?.feedbackSubtitle
          : feedbackSubtitle,
    },
    features: { ...def.features, ...s.features },
    website: { ...def.website, ...s.website },
    proactive: { ...def.proactive, ...s.proactive },
    defaultOpen: s.defaultOpen ?? def.defaultOpen,
  };
}

export function pathMatchesPrefixes(
  path: string | null | undefined,
  prefixes: string[] | undefined,
): boolean {
  if (!prefixes?.length) return false;
  const p = path || "/";
  return prefixes.some((raw) => {
    const cleaned = raw.trim();
    if (!cleaned) return false;
    if (p === cleaned) return true;
    const prefix = cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
    return p.startsWith(prefix) || p.startsWith(cleaned);
  });
}

export function shouldShowWidgetOnPath(
  path: string | null | undefined,
  website: StoredWidgetConfig["website"],
): boolean {
  if (pathMatchesPrefixes(path, website?.hiddenPathPrefixes)) return false;
  const visible = website?.visiblePathPrefixes?.filter((x) => x.trim()) ?? [];
  if (visible.length === 0) return true;
  return pathMatchesPrefixes(path, visible);
}

export function shouldAutoOpenOnPath(
  path: string | null | undefined,
  config: Pick<StoredWidgetConfig, "defaultOpen" | "website">,
): boolean {
  if (config.defaultOpen) return true;
  return pathMatchesPrefixes(path, config.website?.autoOpenPathPrefixes);
}

/** Load org branding/layout (client API key). Null if missing key or request fails. */
export async function fetchWidgetConfig(options?: {
  apiKey?: string | null;
}): Promise<StoredWidgetConfig | null> {
  const key = options?.apiKey?.trim();
  const auth = key
    ? {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      }
    : tryGetAuthHeaders();
  if ("error" in auth) return null;
  try {
    const res = await fetch(apiUrl("/api/v1/widget-config/public"), {
      headers: auth.headers,
      cache: "no-store",
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: StoredWidgetConfig;
    };
    if (!json.success || !json.data) return null;
    return mergeWidgetConfig(json.data);
  } catch {
    return null;
  }
}
