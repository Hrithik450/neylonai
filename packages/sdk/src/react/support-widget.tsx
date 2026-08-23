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
import { useThreadMessageStore, useThreadStore } from "./store/thread-store";
import {
  useWidgetNavigationStore,
  useWidgetToggleStore,
} from "./store/widget-store";
import { Widget } from "./widget/widget";
import {
  LauncherSuggestionBubble,
  useProactivePendingStore,
  useProactiveSuggestions,
  useWidgetAudio,
} from "./proactive";
import { useWidgetFont } from "./hooks/use-widget-font";
import { getLatestHumanReply } from "../retention";
import { getOrCreateVisitorId } from "../visitor";

const LAUNCHER_SIZE_PX = {
  sm: 48,
  md: 56,
  lg: 64,
} as const;

/** Narrow screens have less room, so the launcher sits closer to the edge. */
const MOBILE_OFFSET_X_PX = 10;

/**
 * A human reply is a nudge, not a live feed — the open widget polls the thread
 * itself every few seconds, so this only has to cover the closed launcher.
 */
const HUMAN_REPLY_POLL_MS = 30_000;

/**
 * Shared across mounts so SPA remounts and dev Fast Refresh can't turn the
 * "check once on mount" into a burst of requests.
 */
let lastHumanReplyCheckAt = 0;

/** Runtime fields from the host + remote appearance + code-owned overrides. */
function mergeRuntimeAndAppearance(
  host: SupportWidgetConfig | undefined,
  appearance: StoredWidgetConfig | null,
  opts: {
    presentation?: "fixed" | "inline";
    className?: string;
  },
): ResolvedWidgetConfig {
  const customization = host?.customization;
  const base = mergeWidgetConfig({
    ...appearance,
    ...customization,
    branding: {
      ...appearance?.branding,
      ...customization?.branding,
    },
    layout: {
      ...appearance?.layout,
      ...customization?.layout,
    },
    messages: {
      ...appearance?.messages,
      ...customization?.messages,
    },
    features: {
      ...appearance?.features,
      ...customization?.features,
    },
    website: {
      ...appearance?.website,
      ...customization?.website,
    },
    proactive: {
      ...appearance?.proactive,
      ...customization?.proactive,
    },
  });
  return {
    ...base,
    apiKey: host?.apiKey,
    user: host?.user,
    pagePath: host?.pagePath ?? null,
    presentation: opts.presentation ?? "fixed",
    className: opts.className,
    defaultOpen:
      Boolean(host?.defaultOpen) || shouldAutoOpenOnPath(host?.pagePath, base),
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
  const { active, visible, clickActive } = useProactiveSuggestions();
  const [humanReply, setHumanReply] = useState<{
    id: string;
    text: string;
    threadId: string;
    threadTitle: string;
  } | null>(null);
  const displayedSuggestion = humanReply ?? active;
  const suggestionVisible = Boolean(humanReply) || visible;
  useWidgetAudio(displayedSuggestion?.id ?? null, suggestionVisible);
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (config.presentation === "inline" || config.staticDemo) return;
    // Nothing to nudge about while the visitor is already inside the widget
    // (the thread view polls for human replies itself), or while a reply
    // bubble is still on screen.
    if (isOpen || humanReply) return;

    let cancelled = false;
    let interval: number | null = null;
    const visitorId = config.user?.id?.trim() || getOrCreateVisitorId();
    const storageKey = `neylonai:last-human-reply:${visitorId}`;

    const check = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      lastHumanReplyCheckAt = Date.now();
      const result = await getLatestHumanReply(visitorId);
      const reply = result.success ? result.data : null;
      if (!reply || cancelled) return;
      let seen: string | null = null;
      try {
        seen = localStorage.getItem(storageKey);
      } catch {
        // Storage can be unavailable in privacy modes.
      }
      if (reply.messageId === seen) return;
      setHumanReply({
        id: `human-reply:${reply.messageId}`,
        text: "You received a reply from our team. Tap to view.",
        threadId: reply.threadId,
        threadTitle: reply.threadTitle,
      });
      try {
        localStorage.setItem(storageKey, reply.messageId);
      } catch {
        // The in-memory state still prevents repeats during this mount.
      }
    };

    const stopPolling = () => {
      if (interval === null) return;
      window.clearInterval(interval);
      interval = null;
    };

    const startPolling = () => {
      if (interval !== null) return;
      interval = window.setInterval(() => void check(), HUMAN_REPLY_POLL_MS);
    };

    // A hidden tab runs no timer at all; coming back checks immediately, so
    // the visitor still sees the reply the moment they return.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void check();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") {
      if (Date.now() - lastHumanReplyCheckAt > HUMAN_REPLY_POLL_MS / 2) {
        void check();
      }
      startPolling();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    config.presentation,
    config.staticDemo,
    config.user?.id,
    humanReply,
    isOpen,
  ]);

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
      clickActive();
      // Open the panel first so the message screen is visible when we send.
      setIsOpen(true);
      setCurrentThreadId(null);
      useThreadMessageStore.getState().setMessages([]);
      useWidgetNavigationStore.getState().openNewChat();
      useProactivePendingStore.getState().setPendingQuestion(question);
    },
    [clickActive, setCurrentThreadId, setIsOpen],
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
        ["--neylonai-offset-x" as string]: `${layout.offsetX}px`,
        ["--neylonai-offset-x-mobile" as string]: `${Math.min(
          layout.offsetX,
          MOBILE_OFFSET_X_PX,
        )}px`,
      } as React.CSSProperties);

  return (
    <div
      className={cn(
        inline
          ? "relative z-10 flex flex-col items-end w-full h-full min-w-0 max-w-full overflow-hidden justify-end"
          : "fixed z-[110] flex flex-col",
        !inline && (isLeft ? "items-start" : "items-end"),
        !inline &&
          (isLeft
            ? "left-[var(--neylonai-offset-x)] right-auto max-md:left-[var(--neylonai-offset-x-mobile)]"
            : "right-[var(--neylonai-offset-x)] left-auto max-md:right-[var(--neylonai-offset-x-mobile)]"),
        className ?? config.className,
      )}
      style={{
        fontFamily,
        ...positionStyle,
      }}
    >
      <Widget />

      {layout.launcherVisible ? (
        <div
          className={cn(
            "relative z-20 shrink-0",
            // Fullscreen mobile chat covers the launcher; keep it for desktop/inline.
            isOpen && !inline && "max-md:hidden",
          )}
          data-proactive-suggestion
        >
          {displayedSuggestion && (
            <LauncherSuggestionBubble
              suggestion={displayedSuggestion}
              visible={suggestionVisible}
              align={isLeft ? "left" : "right"}
              onSelect={
                humanReply
                  ? () => {
                      navigate(
                        WidgetTabs.Messages,
                        WidgetScreens.MessagesScreens.Messages,
                        {
                          threadId: humanReply.threadId,
                          title: humanReply.threadTitle,
                        },
                      );
                      setIsOpen(true);
                      setHumanReply(null);
                    }
                  : openSuggestionInChat
              }
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
 * Dashboard config loads for the API key. Optional code customization wins.
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
    appearance?.branding?.primaryTextColor,
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

  const handleOpenChange = React.useCallback((open: boolean) => {
    onOpenChangeRef.current?.(open);
  }, []);

  if (!appearanceReady) {
    return null;
  }

  if (!shouldShowWidgetOnPath(merged.pagePath, merged.website)) {
    return null;
  }

  return (
    <WidgetHostProvider config={merged} onError={onError}>
      <SupportWidgetInner
        onOpenChange={handleOpenChange}
        className={className}
      />
    </WidgetHostProvider>
  );
}
