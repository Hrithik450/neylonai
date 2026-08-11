"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "../ui";
import { ChevronRight, Sparkles } from "lucide-react";
import { configureNeylonai } from "../runtime-config";
import {
  fetchWidgetConfig,
  mergeWidgetConfig,
  shouldAutoOpenOnPath,
  shouldShowWidgetOnPath,
  type StoredWidgetConfig,
} from "../widget-config";
import type {
  ResolvedWidgetConfig,
  SupportWidgetConfig,
  SupportWidgetProps,
} from "./config/types";
import { WidgetScreens, WidgetTabs } from "./constants";
import { WidgetHostProvider, useWidgetHost } from "./context/widget-host";
import { useWidgetNavigation } from "./hooks/use-widget-navigation";
import { useThreadStore } from "./store/thread-store";
import { useWidgetToggleStore } from "./store/widget-store";
import { Widget } from "./widget/widget";
import {
  LauncherSuggestionBubble,
  useProactivePendingStore,
  useProactiveSuggestions,
  useWidgetAudio,
} from "./proactive";
import { useWidgetFont } from "./hooks/use-widget-font";

const LAUNCHER_SIZE_PX = {
  sm: 48,
  md: 56,
  lg: 64,
} as const;

/** Runtime fields from the host + remote dashboard appearance. */
function mergeRuntimeAndAppearance(
  host: SupportWidgetConfig | undefined,
  appearance: StoredWidgetConfig | null,
  opts: {
    presentation?: "fixed" | "inline";
    className?: string;
  },
): ResolvedWidgetConfig {
  const base = mergeWidgetConfig(appearance);
  return {
    ...base,
    apiKey: host?.apiKey,
    user: host?.user,
    pagePath: host?.pagePath ?? null,
    presentation: opts.presentation ?? "fixed",
    className: opts.className,
    defaultOpen:
      Boolean(host?.defaultOpen) ||
      shouldAutoOpenOnPath(host?.pagePath, base),
  };
}

function SupportWidgetInner({
  onOpenChange,
  className,
}: {
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const { config } = useWidgetHost();
  const { isOpen, setIsOpen } = useWidgetToggleStore();
  const { navigate } = useWidgetNavigation();
  const { setCurrentThreadId } = useThreadStore();
  const { active, visible } = useProactiveSuggestions();
  useWidgetAudio(active?.id ?? null, visible);
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  // Mint / refresh durable anonymous id early (localStorage + cookie).
  React.useEffect(() => {
    if (config.user?.id) return;
    void import("../visitor").then(({ getOrCreateVisitorId }) => {
      getOrCreateVisitorId();
    });
  }, [config.user?.id]);

  const openSuggestionInChat = React.useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question) return;
      setCurrentThreadId(null);
      useProactivePendingStore.getState().setPendingQuestion(question);
      navigate(WidgetTabs.Messages, WidgetScreens.MessagesScreens.Messages);
      setIsOpen(true);
    },
    [navigate, setCurrentThreadId, setIsOpen],
  );

  useEffect(() => {
    onOpenChangeRef.current?.(isOpen);
  }, [isOpen]);

  const layout = config.layout;
  const inline = config.presentation === "inline";
  const sizePx = LAUNCHER_SIZE_PX[layout.launcherSize];
  const isLeft = layout.position === "bottom-left";
  const { fontFamily } = useWidgetFont(config.branding.font);

  // Keep page scroll from chaining out of the open fixed widget.
  useEffect(() => {
    if (inline || !isOpen) return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyPaddingRight = body.style.paddingRight;
    const scrollbarGap = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.paddingRight = prevBodyPaddingRight;
    };
  }, [inline, isOpen]);

  const positionStyle = inline
    ? undefined
    : ({
        bottom: layout.offsetY,
        ...(isLeft
          ? { left: layout.offsetX, right: "auto" }
          : { right: layout.offsetX, left: "auto" }),
      } as React.CSSProperties);

  return (
    <div
      className={cn(
        inline
          ? "relative z-10 flex flex-col items-end w-full h-full min-w-0 max-w-full overflow-hidden justify-end"
          : "fixed z-99 flex flex-col",
        !inline && (isLeft ? "items-start" : "items-end"),
        className ?? config.className,
      )}
      style={{
        fontFamily,
        ...positionStyle,
      }}
    >
      <Widget />

      {layout.launcherVisible ? (
        <div className="relative z-20 shrink-0" data-proactive-suggestion>
          {active && (
            <LauncherSuggestionBubble
              suggestion={active}
              visible={visible}
              align={isLeft ? "left" : "right"}
              onSelect={openSuggestionInChat}
            />
          )}

          <button
            type="button"
            data-testid="ask-ai-launcher"
            aria-label={isOpen ? "Close AI chat" : "Ask AI"}
            onClick={() => setIsOpen(!isOpen)}
            className="border border-white/80 cursor-pointer rounded-full flex items-center justify-center p-0 transition-transform duration-200 hover:scale-105 active:scale-95 hover:opacity-90 shrink-0"
            style={{
              backgroundColor: config.branding.primaryTextBackground,
              color: config.branding.askButtonTextColor,
              width: sizePx,
              height: sizePx,
            }}
          >
            <span
              className={cn(
                isOpen ? "rotate-90" : "rotate-0",
                "transform transition-transform duration-200 flex items-center justify-center text-current",
              )}
            >
              {isOpen ? (
                <ChevronRight
                  className="size-7"
                  strokeWidth={2.25}
                  stroke="currentColor"
                />
              ) : (
                <Sparkles
                  className="size-7"
                  strokeWidth={2.25}
                  stroke="currentColor"
                />
              )}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Embeddable Neylon AI chatbot.
 *
 *   <SupportWidget config={{ apiKey: "nk_live_…" }} />
 *
 * Branding/layout/copy load from the Neylon dashboard for that API key.
 */
export function SupportWidget({
  config,
  presentation,
  className,
  onError,
  onOpenChange,
}: SupportWidgetProps) {
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const [remote, setRemote] = useState<StoredWidgetConfig | null>(null);
  const loadRemote = Boolean(config?.apiKey);
  // Wait for remote appearance so branding/copy don't flash from defaults.
  const [appearanceReady, setAppearanceReady] = useState(!loadRemote);

  useEffect(() => {
    configureNeylonai({
      apiKey: config?.apiKey,
    });
  }, [config?.apiKey]);

  useEffect(() => {
    if (!loadRemote) {
      setRemote(null);
      setAppearanceReady(true);
      return;
    }

    let cancelled = false;
    setRemote(null);
    setAppearanceReady(false);

    // Fail-safe only unblocks the UI — never blocks a late successful fetch.
    const failSafe = window.setTimeout(() => {
      if (!cancelled) setAppearanceReady(true);
    }, 2500);

    void fetchWidgetConfig({ apiKey: config?.apiKey }).then((data) => {
      if (cancelled) return;
      if (data) setRemote(data);
      setAppearanceReady(true);
      window.clearTimeout(failSafe);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, [loadRemote, config?.apiKey]);

  const appearance = remote;
  const appearanceEpoch = [
    appearance?.branding?.gradientFrom,
    appearance?.branding?.gradientTo,
    appearance?.branding?.headerTint,
    appearance?.branding?.primaryTextColor,
    appearance?.branding?.primaryColor,
    appearance?.branding?.secondaryTextColor,
    appearance?.branding?.tabActiveColor,
    appearance?.branding?.accentColor,
    appearance?.branding?.primaryTextBackground,
    appearance?.branding?.askButtonTextColor,
    appearance?.branding?.secondaryTextBackground,
    appearance?.branding?.aiMessageBackground,
    appearance?.branding?.humanMessageBackground,
    appearance?.branding?.name,
    appearance?.branding?.logoUrl,
    appearance?.branding?.font?.customFontUrl,
    appearance?.branding?.font?.family,
    appearance?.branding?.font?.source,
    appearance?.layout?.position,
    appearance?.layout?.launcherSize,
    appearance?.layout?.offsetX,
    appearance?.layout?.offsetY,
    appearance?.layout?.launcherVisible,
    appearance?.messages?.askTitle,
    appearance?.messages?.askSubtitle,
    appearance?.messages?.feedbackTitle,
    appearance?.messages?.feedbackSubtitle,
    appearance?.messages?.welcomeGreeting,
    JSON.stringify(appearance?.messages?.introMessages ?? null),
    JSON.stringify(appearance?.messages?.faqs ?? null),
    appearance?.proactive?.enabled,
    appearance?.proactive?.soundEnabled,
  ].join("|");

  const merged = useMemo(
    () =>
      mergeRuntimeAndAppearance(config, appearance, {
        presentation,
        className,
      }),
    [config, appearance, appearanceEpoch, presentation, className],
  );

  useEffect(() => {
    if (!appearanceReady) return;
    if (merged.defaultOpen) {
      useWidgetToggleStore.getState().setIsOpen(true);
    }
  }, [appearanceReady, merged.defaultOpen]);

  useEffect(() => {
    if (!appearanceReady) return;
    void import("../analytics").then(({ trackAnalytics }) => {
      trackAnalytics("widget_impression", {
        pagePath: merged.pagePath ?? null,
      });
    });
  }, [appearanceReady, merged.pagePath]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      void import("../analytics").then(({ trackAnalytics }) => {
        trackAnalytics(open ? "widget_opened" : "widget_closed", {
          pagePath: merged.pagePath ?? null,
        });
      });
      onOpenChangeRef.current?.(open);
    },
    [merged.pagePath],
  );

  if (!appearanceReady) {
    return null;
  }

  if (!shouldShowWidgetOnPath(merged.pagePath, merged.website)) {
    return null;
  }

  return (
    <WidgetHostProvider config={merged} onError={onError}>
      <SupportWidgetInner onOpenChange={handleOpenChange} className={className} />
    </WidgetHostProvider>
  );
}
