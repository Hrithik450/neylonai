"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { ResolvedWidgetConfig, SupportWidgetProps } from "../config/types";
import {
  DEFAULT_WIDGET_FEATURES,
  DEFAULT_WIDGET_LAYOUT,
  DEFAULT_WIDGET_MESSAGES,
} from "../config/types";
import { DEFAULT_WIDGET_CONFIG } from "../../widget-config";
import { PROACTIVE_CONFIG } from "../proactive/config";

const DEFAULT_BRANDING = {
  name: "",
  primaryTextColor: DEFAULT_WIDGET_CONFIG.branding!.primaryTextColor!,
  secondaryTextColor: DEFAULT_WIDGET_CONFIG.branding!.secondaryTextColor!,
  accentColor: DEFAULT_WIDGET_CONFIG.branding!.accentColor!,
  tabActiveColor: DEFAULT_WIDGET_CONFIG.branding!.tabActiveColor!,
  gradientFrom: DEFAULT_WIDGET_CONFIG.branding!.gradientFrom!,
  gradientTo: DEFAULT_WIDGET_CONFIG.branding!.gradientTo!,
  primaryTextBackground: DEFAULT_WIDGET_CONFIG.branding!.primaryTextBackground!,
  askButtonTextColor: DEFAULT_WIDGET_CONFIG.branding!.askButtonTextColor!,
  secondaryTextBackground:
    DEFAULT_WIDGET_CONFIG.branding!.secondaryTextBackground!,
  aiMessageBackground: DEFAULT_WIDGET_CONFIG.branding!.aiMessageBackground!,
  humanMessageBackground:
    DEFAULT_WIDGET_CONFIG.branding!.humanMessageBackground!,
  tagline: "AI assistants for modern businesses",
} as const;

export interface WidgetHostValue {
  config: Required<Pick<ResolvedWidgetConfig, "pagePath" | "presentation">> &
    ResolvedWidgetConfig & {
      branding: NonNullable<ResolvedWidgetConfig["branding"]> & {
        name: string;
        primaryTextColor: string;
        secondaryTextColor: string;
        accentColor: string;
        tabActiveColor: string;
        gradientFrom: string;
        gradientTo: string;
        primaryTextBackground: string;
        askButtonTextColor: string;
        secondaryTextBackground: string;
        aiMessageBackground: string;
        humanMessageBackground: string;
      };
      layout: Required<NonNullable<ResolvedWidgetConfig["layout"]>>;
      messages: Required<
        Pick<
          NonNullable<ResolvedWidgetConfig["messages"]>,
          | "welcomeGreeting"
          | "introMessages"
          | "inputPlaceholder"
          | "suggestedQuestions"
          | "askTitle"
          | "askSubtitle"
          | "feedbackTitle"
          | "feedbackSubtitle"
          | "faqs"
        >
      >;
      features: Required<NonNullable<ResolvedWidgetConfig["features"]>>;
      proactive: {
        enabled: boolean;
        soundEnabled: boolean;
        volume: number;
        initialIdleMs: number;
        displayMs: number;
        rotateGapMs: number;
        postChatDelayMs: number;
        poolLimit: number;
      };
    };
  user: ResolvedWidgetConfig["user"];
  isAuthenticated: boolean;
  onError: (message: string) => void;
}

const WidgetHostContext = createContext<WidgetHostValue | null>(null);

const pickColor = (...candidates: Array<string | null | undefined>) =>
  candidates.find((c) => c?.trim())?.trim();

export function WidgetHostProvider({
  config,
  onError,
  children,
}: {
  config?: ResolvedWidgetConfig;
  onError?: SupportWidgetProps["onError"];
  children: React.ReactNode;
}) {
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;
  const stableOnError = React.useCallback(
    (message: string) => onErrorRef.current?.(message),
    [],
  );

  const value = useMemo<WidgetHostValue>(() => {
    const b = config?.branding;
    const pick = (val: string | null | undefined, fallback: string) =>
      pickColor(val) ?? fallback;

    const branding = {
      ...DEFAULT_BRANDING,
      ...b,
      name: b?.name ?? "",
      primaryTextColor: pick(
        b?.primaryTextColor,
        DEFAULT_BRANDING.primaryTextColor,
      ),
      secondaryTextColor: pick(
        b?.secondaryTextColor,
        DEFAULT_BRANDING.secondaryTextColor,
      ),
      tabActiveColor: pick(b?.tabActiveColor, DEFAULT_BRANDING.tabActiveColor),
      accentColor: pick(b?.accentColor, DEFAULT_BRANDING.accentColor),
      gradientFrom: pick(b?.gradientFrom, DEFAULT_BRANDING.gradientFrom),
      gradientTo: pick(b?.gradientTo, DEFAULT_BRANDING.gradientTo),
      primaryTextBackground:
        pickColor(b?.primaryTextBackground, b?.primaryTextColor) ??
        DEFAULT_BRANDING.primaryTextBackground,
      askButtonTextColor: pick(
        b?.askButtonTextColor,
        DEFAULT_BRANDING.askButtonTextColor,
      ),
      secondaryTextBackground: pick(
        b?.secondaryTextBackground,
        DEFAULT_BRANDING.secondaryTextBackground,
      ),
      aiMessageBackground: pick(
        b?.aiMessageBackground,
        DEFAULT_BRANDING.aiMessageBackground,
      ),
      humanMessageBackground: pick(
        b?.humanMessageBackground,
        DEFAULT_BRANDING.humanMessageBackground,
      ),
      font: b?.font,
    };

    const layout = {
      ...DEFAULT_WIDGET_LAYOUT,
      ...config?.layout,
    };

    const messages = {
      ...DEFAULT_WIDGET_MESSAGES,
      ...config?.messages,
      introMessages: config?.messages?.introMessages?.length
        ? config.messages.introMessages
        : [...DEFAULT_WIDGET_MESSAGES.introMessages],
      suggestedQuestions: config?.messages?.suggestedQuestions?.length
        ? config.messages.suggestedQuestions
        : [...DEFAULT_WIDGET_MESSAGES.suggestedQuestions],
      faqs: (() => {
        const raw = Array.isArray(config?.messages?.faqs)
          ? config.messages.faqs
          : null;
        const cleaned = (raw ?? [])
          .map((f) => ({
            question: typeof f?.question === "string" ? f.question.trim() : "",
            answer: typeof f?.answer === "string" ? f.answer.trim() : "",
          }))
          .filter((f) => f.question && f.answer)
          .slice(0, 4);
        return cleaned.length > 0 ? cleaned : [...DEFAULT_WIDGET_MESSAGES.faqs];
      })(),
    };

    const features = {
      ...DEFAULT_WIDGET_FEATURES,
      ...config?.features,
    };

    const proactive = {
      enabled: config?.proactive?.enabled ?? true,
      soundEnabled:
        config?.proactive?.soundEnabled ?? PROACTIVE_CONFIG.soundEnabled,
      volume: config?.proactive?.volume ?? 0.22,
      initialIdleMs:
        config?.proactive?.initialIdleMs ?? PROACTIVE_CONFIG.initialIdleMs,
      displayMs: config?.proactive?.displayMs ?? PROACTIVE_CONFIG.displayMs,
      rotateGapMs:
        config?.proactive?.rotateGapMs ?? PROACTIVE_CONFIG.rotateGapMs,
      postChatDelayMs:
        config?.proactive?.postChatDelayMs ?? PROACTIVE_CONFIG.postChatDelayMs,
      poolLimit: config?.proactive?.poolLimit ?? PROACTIVE_CONFIG.poolLimit,
    };

    return {
      config: {
        ...config,
        pagePath: config?.pagePath ?? null,
        presentation: config?.presentation ?? "fixed",
        branding,
        layout,
        messages,
        features,
        proactive,
      },
      user: config?.user ?? null,
      isAuthenticated: Boolean(config?.user?.id),
      onError: stableOnError,
    };
  }, [
    config,
    // Explicit branding deps so color edits always invalidate context
    // even if a parent memo reuses a config object reference.
    config?.branding?.primaryTextColor,
    config?.branding?.secondaryTextColor,
    config?.branding?.tabActiveColor,
    config?.branding?.accentColor,
    config?.branding?.gradientFrom,
    config?.branding?.gradientTo,
    config?.branding?.primaryTextBackground,
    config?.branding?.askButtonTextColor,
    config?.branding?.secondaryTextBackground,
    config?.branding?.aiMessageBackground,
    config?.branding?.humanMessageBackground,
    config?.branding?.name,
    config?.branding?.logoUrl,
    config?.branding?.font,
    config?.layout?.position,
    config?.layout?.launcherSize,
    config?.layout?.offsetX,
    config?.layout?.offsetY,
    config?.layout?.launcherVisible,
    config?.messages?.askTitle,
    config?.messages?.askSubtitle,
    config?.messages?.feedbackTitle,
    config?.messages?.feedbackSubtitle,
    config?.messages?.welcomeGreeting,
    config?.messages?.introMessages,
    config?.messages?.faqs,
    config?.proactive?.enabled,
    config?.proactive?.soundEnabled,
    stableOnError,
  ]);

  return (
    <WidgetHostContext.Provider value={value}>
      {children}
    </WidgetHostContext.Provider>
  );
}

export function useWidgetHost(): WidgetHostValue {
  const ctx = useContext(WidgetHostContext);
  if (!ctx) {
    throw new Error("useWidgetHost must be used within WidgetHostProvider");
  }
  return ctx;
}
