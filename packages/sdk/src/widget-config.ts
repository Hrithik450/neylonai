/**
 * Org-stored / remotely fetched widget appearance config.
 * Runtime-only fields (apiKey, user, pagePath) stay on SupportWidgetConfig.
 */
import { tryGetAuthHeaders } from "./runtime-config";
import { apiUrl } from "./network";
import { DEFAULT_WIDGET_FONT } from "./font-catalog";

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
    /**
     * Brand color (legacy). Prefer primaryTextColor (heading) and
     * primaryTextBackground (Ask button fill).
     * @deprecated
     */
    primaryColor?: string;
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
    /**
     * Top stop of the panel background gradient.
     * @deprecated Prefer gradientFrom.
     */
    headerTint?: string;
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
    postChatDelayMs?: number;
    poolLimit?: number;
  };
  defaultOpen?: boolean;
};

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
  /** Home “Talk to the team” card (legacy keys: feedbackTitle / feedbackSubtitle). */
  feedbackTitle: "Talk to the team",
  feedbackSubtitle:
    "We escalate with full context when AI can't resolve it",
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

export const DEFAULT_WIDGET_CONFIG: StoredWidgetConfig = {
  branding: {
    name: "",
    logoUrl: "",
    primaryColor: "#0E3228",
    primaryTextColor: "#0E3228",
    secondaryTextColor: "rgba(0, 0, 0, 0.7)",
    accentColor: "#71717a",
    tabActiveColor: "#0E3228",
    headerTint: "rgb(144, 238, 144)",
    gradientFrom: "rgb(144, 238, 144)",
    gradientTo: "#ffffff",
    primaryTextBackground: "#0E3228",
    askButtonTextColor: "#ffffff",
    secondaryTextBackground: "#ffffff",
    aiMessageBackground: "transparent",
    humanMessageBackground: "#e4e4e7",
    tagline: "AI assistants for modern businesses",
    font: { ...DEFAULT_WIDGET_FONT },
  },
  layout: { ...DEFAULT_WIDGET_LAYOUT },
  messages: {
    welcomeGreeting: DEFAULT_WIDGET_MESSAGES.welcomeGreeting,
    introMessages: [...DEFAULT_WIDGET_MESSAGES.introMessages],
    inputPlaceholder: DEFAULT_WIDGET_MESSAGES.inputPlaceholder,
    suggestedQuestions: [...DEFAULT_WIDGET_MESSAGES.suggestedQuestions],
    askTitle: DEFAULT_WIDGET_MESSAGES.askTitle,
    askSubtitle: DEFAULT_WIDGET_MESSAGES.askSubtitle,
    feedbackTitle: DEFAULT_WIDGET_MESSAGES.feedbackTitle,
    feedbackSubtitle: DEFAULT_WIDGET_MESSAGES.feedbackSubtitle,
    faqs: [...DEFAULT_WIDGET_MESSAGES.faqs],
  },
  features: { ...DEFAULT_WIDGET_FEATURES },
  website: {
    visiblePathPrefixes: [],
    hiddenPathPrefixes: [],
    autoOpenPathPrefixes: [],
  },
  proactive: {
    enabled: true,
    soundEnabled: true,
    volume: 0.22,
    initialIdleMs: 2_200,
    displayMs: 6_500,
    rotateGapMs: 4_500,
    postChatDelayMs: 2_000,
    poolLimit: 5,
  },
  defaultOpen: false,
};

/** Platform branding color schema version (bump when default roles/values change). */
export const BRANDING_COLORS_VERSION = 1;

/**
 * Replace color fields with the current platform palette (Reset), keeping
 * name / logo / font / tagline. Used for one-time load migration.
 */
export function withPlatformBrandingColors(
  config: StoredWidgetConfig,
): StoredWidgetConfig {
  const d = DEFAULT_WIDGET_CONFIG.branding!;
  const b = config.branding ?? {};
  return {
    ...config,
    branding: {
      ...b,
      primaryColor: d.primaryColor,
      primaryTextColor: d.primaryTextColor,
      secondaryTextColor: d.secondaryTextColor,
      accentColor: d.accentColor,
      tabActiveColor: d.tabActiveColor,
      headerTint: d.headerTint,
      gradientFrom: d.gradientFrom,
      gradientTo: d.gradientTo,
      primaryTextBackground: d.primaryTextBackground,
      askButtonTextColor: d.askButtonTextColor,
      secondaryTextBackground: d.secondaryTextBackground,
      aiMessageBackground: d.aiMessageBackground,
      humanMessageBackground: d.humanMessageBackground,
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
export function mergeWidgetConfig(
  stored?: StoredWidgetConfig | null,
): StoredWidgetConfig {
  const s = stored ?? {};
  // Drop legacy socialLinks from older stored rows (no longer part of branding).
  const {
    socialLinks: _legacySocialLinks,
    ...storedBranding
  } = (s.branding ?? {}) as NonNullable<StoredWidgetConfig["branding"]> & {
    socialLinks?: unknown;
  };
  return {
    ...DEFAULT_WIDGET_CONFIG,
    ...s,
    branding: {
      ...DEFAULT_WIDGET_CONFIG.branding,
      ...storedBranding,
      font: {
        ...DEFAULT_WIDGET_FONT,
        ...DEFAULT_WIDGET_CONFIG.branding?.font,
        ...storedBranding.font,
      },
      // Normalize new color fields from legacy keys when missing.
      primaryTextColor:
        storedBranding.primaryTextColor?.trim() ||
        storedBranding.primaryColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.primaryTextColor,
      secondaryTextColor:
        storedBranding.secondaryTextColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.secondaryTextColor,
      tabActiveColor:
        storedBranding.tabActiveColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.tabActiveColor,
      accentColor:
        storedBranding.accentColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.accentColor,
      gradientFrom:
        storedBranding.gradientFrom?.trim() ||
        storedBranding.headerTint?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.gradientFrom,
      gradientTo:
        storedBranding.gradientTo?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.gradientTo,
      // Ask CTA fill — fall back to brand text/primary so older configs stay dark.
      primaryTextBackground:
        storedBranding.primaryTextBackground?.trim() ||
        storedBranding.primaryTextColor?.trim() ||
        storedBranding.primaryColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.primaryTextBackground,
      askButtonTextColor:
        storedBranding.askButtonTextColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.askButtonTextColor,
      secondaryTextBackground:
        storedBranding.secondaryTextBackground?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.secondaryTextBackground,
      aiMessageBackground:
        storedBranding.aiMessageBackground?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.aiMessageBackground,
      humanMessageBackground:
        storedBranding.humanMessageBackground?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.humanMessageBackground,
      // Keep legacy mirrors in sync for older readers.
      primaryColor:
        storedBranding.primaryTextColor?.trim() ||
        storedBranding.primaryColor?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.primaryColor,
      headerTint:
        storedBranding.gradientFrom?.trim() ||
        storedBranding.headerTint?.trim() ||
        DEFAULT_WIDGET_CONFIG.branding?.headerTint,
      // Only stamp from storage — never inherit a default version or migration
      // would be skipped after a partial merge/persist.
      colorsVersion: storedBranding.colorsVersion,
    },
    layout: { ...DEFAULT_WIDGET_CONFIG.layout, ...s.layout },
    messages: {
      ...DEFAULT_WIDGET_CONFIG.messages,
      ...s.messages,
      introMessages: s.messages?.introMessages?.length
        ? s.messages.introMessages
        : DEFAULT_WIDGET_CONFIG.messages?.introMessages,
      suggestedQuestions: s.messages?.suggestedQuestions?.length
        ? s.messages.suggestedQuestions
        : DEFAULT_WIDGET_CONFIG.messages?.suggestedQuestions,
      faqs: (() => {
        const raw = Array.isArray(s.messages?.faqs) ? s.messages.faqs : null;
        const cleaned = (raw ?? [])
          .map((f) => ({
            question: typeof f?.question === "string" ? f.question.trim() : "",
            answer: typeof f?.answer === "string" ? f.answer.trim() : "",
          }))
          .filter((f) => f.question && f.answer)
          .slice(0, 4);
        return cleaned.length > 0
          ? cleaned
          : [...(DEFAULT_WIDGET_CONFIG.messages?.faqs ?? [])];
      })(),
      faqsInitialized: s.messages?.faqsInitialized === true,
      // Prefer new contact copy; fall back to defaults (migrate old feedback wording).
      feedbackTitle: (() => {
        const t = s.messages?.feedbackTitle?.trim() || "";
        if (!t || t === "Share Your Feedback") {
          return DEFAULT_WIDGET_CONFIG.messages?.feedbackTitle;
        }
        return t;
      })(),
      feedbackSubtitle: (() => {
        const t = s.messages?.feedbackSubtitle?.trim() || "";
        if (!t || t === "Help us improve with your feedback.") {
          return DEFAULT_WIDGET_CONFIG.messages?.feedbackSubtitle;
        }
        return t;
      })(),
    },
    features: { ...DEFAULT_WIDGET_CONFIG.features, ...s.features },
    website: {
      ...DEFAULT_WIDGET_CONFIG.website,
      ...s.website,
      visiblePathPrefixes:
        s.website?.visiblePathPrefixes ??
        DEFAULT_WIDGET_CONFIG.website?.visiblePathPrefixes,
      hiddenPathPrefixes:
        s.website?.hiddenPathPrefixes ??
        DEFAULT_WIDGET_CONFIG.website?.hiddenPathPrefixes,
      autoOpenPathPrefixes:
        s.website?.autoOpenPathPrefixes ??
        DEFAULT_WIDGET_CONFIG.website?.autoOpenPathPrefixes,
    },
    proactive: { ...DEFAULT_WIDGET_CONFIG.proactive, ...s.proactive },
    defaultOpen: s.defaultOpen ?? DEFAULT_WIDGET_CONFIG.defaultOpen,
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
          "X-Neylonai-Api-Key": key,
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
