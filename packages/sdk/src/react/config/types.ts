import type { Thread, ThreadMessage, User } from "../../types";
import type { StoredWidgetConfig } from "../../widget-config";

export {
  DEFAULT_WIDGET_MESSAGES,
  DEFAULT_WIDGET_LAYOUT,
  DEFAULT_WIDGET_FEATURES,
  type StoredWidgetConfig,
} from "../../widget-config";

/** Appearance types used after remote/dashboard config is loaded (not client-configured). */
export interface WidgetBranding {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  /** Heading / emphasis text on the panel and cards. */
  primaryTextColor?: string;
  /** Body / muted text on the panel and cards. */
  secondaryTextColor?: string;
  /** Inactive / unselected tab color. */
  accentColor?: string;
  /** Selected tab color. */
  tabActiveColor?: string;
  headerTint?: string;
  gradientFrom?: string;
  gradientTo?: string;
  /** Ask-a-question CTA (and launcher) fill. */
  primaryTextBackground?: string;
  /** Text/icon color on the Ask CTA and launcher. */
  askButtonTextColor?: string;
  /** FAQ / suggestion card fill. */
  secondaryTextBackground?: string;
  /** AI / assistant chat bubble fill (foreground auto-contrasts). */
  aiMessageBackground?: string;
  /** Human / visitor chat bubble fill (foreground auto-contrasts). */
  humanMessageBackground?: string;
  /** Applied when present on remote/preview config (e.g. first-party mocks). */
  fontClassName?: string;
  headingClassName?: string;
  tagline?: string;
  /** Stored widget typography (dashboard + remote). */
  font?: import("../../widget-config").WidgetFontConfig;
  insights?: Array<{
    id: string | number;
    imageUrl: string;
    type: string;
    date: string;
    title: string;
    href?: string;
  }>;
}

export interface WidgetLayoutConfig {
  position?: "bottom-right" | "bottom-left";
  launcherSize?: "sm" | "md" | "lg";
  offsetX?: number;
  offsetY?: number;
  launcherVisible?: boolean;
}

export interface WidgetMessagesConfig {
  welcomeGreeting?: string;
  introMessages?: string[];
  inputPlaceholder?: string;
  suggestedQuestions?: string[];
  askTitle?: string;
  askSubtitle?: string;
  feedbackTitle?: string;
  feedbackSubtitle?: string;
  faqs?: Array<{ question: string; answer: string }>;
  /** Set after knowledge seed or dashboard publish — never re-derive. */
  faqsInitialized?: boolean;
}

export interface WidgetProactiveConfig {
  enabled?: boolean;
  soundEnabled?: boolean;
  volume?: number;
  initialIdleMs?: number;
  displayMs?: number;
  rotateGapMs?: number;
  postChatDelayMs?: number;
  poolLimit?: number;
}

export interface WidgetFeaturesConfig {
  homeTab?: boolean;
  messagesTab?: boolean;
  contactTab?: boolean;
  /** Mic → AI speech-to-text in the message composer. Default true. */
  voiceInput?: boolean;
}

export interface WidgetWebsiteConfig {
  visiblePathPrefixes?: string[];
  hiddenPathPrefixes?: string[];
  autoOpenPathPrefixes?: string[];
}

/**
 * Public client config. Appearance (branding, layout, copy, proactive, path rules)
 * loads from the Neylon dashboard via the API key — do not set it in code.
 */
export interface SupportWidgetConfig {
  /**
   * Publishable API key (`nk_live_…`). Required for API calls.
   */
  apiKey?: string | null;
  /**
   * Optional. Map from the host app’s existing auth/session when signed in.
   * Omit / null for anonymous visitors.
   */
  user?: Pick<User, "id" | "name" | "email" | "profile_image"> | null;
  /** Optional. Current page path for proactive suggestions + path rules. */
  pagePath?: string | null;
  /** Optional. Open the panel on mount (e.g. after an auth redirect). */
  defaultOpen?: boolean;
}

/** Resolved runtime + appearance after remote fetch. */
export interface ResolvedWidgetConfig extends SupportWidgetConfig {
  branding?: WidgetBranding;
  layout?: WidgetLayoutConfig;
  messages?: WidgetMessagesConfig;
  features?: WidgetFeaturesConfig;
  website?: WidgetWebsiteConfig;
  proactive?: WidgetProactiveConfig;
  presentation?: "fixed" | "inline";
  className?: string;
  /**
   * Dashboard static mock only — seed conversation UI without API calls.
   * Not used by customer embeds.
   */
  staticDemo?: {
    threads?: Thread[];
    messages?: ThreadMessage[];
  };
}

export interface SupportWidgetProps {
  config?: SupportWidgetConfig;
  /** `inline` = relative layout (e.g. framed mock); default `fixed` for site embeds. */
  presentation?: "fixed" | "inline";
  className?: string;
  onError?: (message: string) => void;
  onOpenChange?: (open: boolean) => void;
}
