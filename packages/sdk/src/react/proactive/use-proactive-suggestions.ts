"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSuggestions, type ProactiveSuggestionDto } from "../..";
import { useWidgetToggleStore, useWidgetStore } from "../store/widget-store";
import { useThreadMessageStore } from "../store/thread-store";
import { useWidgetHost } from "../context/widget-host";
import { PROACTIVE_CONFIG } from "./config";
import {
  loadProactiveState,
  pickNextSuggestion,
  saveProactiveState,
  type ProactivePersistedState,
} from "./persistence";

export interface ActiveProactiveSuggestion {
  id: string;
  text: string;
  source: ProactiveSuggestionDto["source"];
}

function isTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

/**
 * Rotating display-only bubbles above Ask AI.
 * Keeps looping for the whole visit while the tab is focused; pauses when the
 * widget opens or the browser tab is hidden; stops when the page unloads.
 */
export function useProactiveSuggestions() {
  const { config } = useWidgetHost();
  const pathname = config.pagePath ?? null;
  const proactive = config.proactive;
  const proactiveEnabled = proactive.enabled;
  const { isOpen } = useWidgetToggleStore();
  const { isStreaming, assistantTyping } = useWidgetStore();
  const { messages } = useThreadMessageStore();

  const [active, setActive] = useState<ActiveProactiveSuggestion | null>(null);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  const stateRef = useRef<ProactivePersistedState>(loadProactiveState());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadOpenRef = useRef(false);
  const fetchingRef = useRef(false);
  const hasChattedRef = useRef(false);
  const welcomeShownRef = useRef(false);
  const showNextRef = useRef<() => Promise<void>>(async () => undefined);

  const persist = useCallback(() => {
    saveProactiveState(stateRef.current);
  }, []);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    idleTimerRef.current = null;
    rotateTimerRef.current = null;
    hideTimerRef.current = null;
  }, []);

  const hideBubble = useCallback(() => {
    setVisible(false);
    setActive(null);
  }, []);

  const canShow = useCallback(() => {
    return (
      proactiveEnabled &&
      !isOpen &&
      !isStreaming &&
      !assistantTyping &&
      isTabVisible()
    );
  }, [assistantTyping, isOpen, isStreaming, proactiveEnabled]);

  const refreshPool = useCallback(
    async (mode: "idle" | "post_chat", force = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const latestMessages = useThreadMessageStore.getState().messages;
        const recentMessages =
          mode === "post_chat" && latestMessages?.length
            ? latestMessages.slice(-8).map((m) => ({
                role: m.role,
                content: m.content,
              }))
            : [];

        const result = await fetchSuggestions({
          pagePath: pathname,
          mode,
          recentMessages,
          limit: Math.min(Math.max(proactive.poolLimit, 3), 5),
          excludeIds: stateRef.current.shownIds.slice(-24),
        });

        if (result.success && result.data.length > 0) {
          stateRef.current = {
            ...stateRef.current,
            pool: result.data,
            poolPagePath: pathname,
            poolMode: mode,
            poolFetchedAt: Date.now(),
            // Fresh pool → allow ids to cycle again.
            shownIds: force ? [] : stateRef.current.shownIds,
          };
          persist();
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [pathname, persist, proactive.poolLimit],
  );

  const scheduleNext = useCallback(
    (delayMs: number) => {
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
      rotateTimerRef.current = setTimeout(() => {
        void showNextRef.current();
      }, delayMs);
    },
    [],
  );

  const showNext = useCallback(async () => {
    if (!canShow()) return;

    const poolAge = Date.now() - stateRef.current.poolFetchedAt;
    const pathChanged = stateRef.current.poolPagePath !== pathname;
    const mode = hasChattedRef.current ? "post_chat" : "idle";
    const modeChanged = stateRef.current.poolMode !== mode;
    const needRefresh =
      stateRef.current.pool.length === 0 ||
      pathChanged ||
      modeChanged ||
      poolAge > PROACTIVE_CONFIG.poolTtlMs;

    if (needRefresh) {
      await refreshPool(mode);
    }

    if (!canShow()) return;

    let next = pickNextSuggestion(
      stateRef.current.pool,
      stateRef.current,
      pathname,
      { preferWelcome: !welcomeShownRef.current },
    );

    // Pool exhausted or stale — fetch again and keep looping.
    if (!next) {
      await refreshPool(hasChattedRef.current ? "post_chat" : "idle", true);
      if (!canShow()) return;
      next = pickNextSuggestion(
        stateRef.current.pool,
        stateRef.current,
        pathname,
        { preferWelcome: !welcomeShownRef.current },
      );
    }

    if (!next) {
      // Transient empty — retry later instead of stopping for the session.
      scheduleNext(proactive.rotateGapMs);
      return;
    }

    if (next.source === "welcome") {
      welcomeShownRef.current = true;
    }

    stateRef.current = {
      ...stateRef.current,
      shownIds: [...stateRef.current.shownIds, next.id].slice(-40),
    };
    persist();

    setActive({ id: next.id, text: next.text, source: next.source });
    setVisible(true);

    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setActive(null);
      scheduleNext(proactive.rotateGapMs);
    }, proactive.displayMs);
  }, [canShow, pathname, persist, proactive.displayMs, proactive.rotateGapMs, refreshPool, scheduleNext]);

  showNextRef.current = showNext;

  const scheduleIdleShow = useCallback(() => {
    clearTimers();
    if (!canShow()) return;
    idleTimerRef.current = setTimeout(() => {
      void showNext();
    }, proactive.initialIdleMs);
  }, [canShow, clearTimers, proactive.initialIdleMs, showNext]);

  useEffect(() => {
    if (messages?.some((m) => m.role === "user")) {
      hasChattedRef.current = true;
    }
  }, [messages]);

  useEffect(() => {
    const onVisibility = () => {
      const visibleNow = isTabVisible();
      setTabVisible(visibleNow);
      if (!visibleNow) {
        clearTimers();
        hideBubble();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearTimers, hideBubble]);

  useEffect(() => {
    if (!proactiveEnabled) {
      clearTimers();
      hideBubble();
      return;
    }

    if (!tabVisible) {
      clearTimers();
      hideBubble();
      return;
    }

    if (isOpen) {
      hadOpenRef.current = true;
      clearTimers();
      hideBubble();
      return;
    }

    if (hadOpenRef.current) {
      hadOpenRef.current = false;
      clearTimers();
      idleTimerRef.current = setTimeout(() => {
        void (async () => {
          if (hasChattedRef.current) {
            await refreshPool("post_chat");
          }
          await showNext();
        })();
      }, proactive.postChatDelayMs);
      return;
    }

    scheduleIdleShow();
  }, [
    clearTimers,
    hideBubble,
    isOpen,
    proactive.postChatDelayMs,
    proactiveEnabled,
    refreshPool,
    scheduleIdleShow,
    showNext,
    tabVisible,
  ]);

  useEffect(() => {
    if (isOpen || !proactiveEnabled || !tabVisible) return;
    clearTimers();
    hideBubble();
    scheduleIdleShow();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    active,
    visible:
      proactiveEnabled &&
      tabVisible &&
      visible &&
      !isOpen &&
      Boolean(active),
  };
}
