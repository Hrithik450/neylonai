"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSuggestions,
  trackProactiveTrigger,
  type ProactiveSuggestionDto,
  type ProactiveTriggerType,
} from "../..";
import { useWidgetToggleStore, useWidgetStore } from "../store/widget-store";
import { useThreadMessageStore } from "../store/thread-store";
import { useWidgetHost } from "../context/widget-host";
import { PROACTIVE_CONFIG } from "./config";
import {
  countsTowardSessionLimit,
  loadProactiveState,
  saveProactiveState,
  sessionBudgetRemaining,
  type ProactivePersistedState,
} from "./persistence";
import {
  dequeueNextSuggestion,
  enqueueSuggestions,
  prependSuggestions,
  type QueuedSuggestion,
} from "./suggestion-queue";
import {
  hasUnreadConversationContext,
  messageContextFingerprint,
} from "./context-fingerprint";

/** One deeply personalized bubble per completed support-widget interaction. */
const ON_DEMAND_BATCH_SIZE = 4;
const FALLBACK_BATCH_SIZE = 5;
const MAX_SHOWN_IDS = 120;

export interface ActiveProactiveSuggestion {
  id: string;
  text: string;
  source: ProactiveSuggestionDto["source"];
}

const isTabVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

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

  const isNewSessionRef = useRef(false);
  const [initialPersistedState] = useState<ProactivePersistedState>(() => {
    const { state, isNewSession } = loadProactiveState();
    isNewSessionRef.current = isNewSession;
    return state;
  });

  const stateRef = useRef<ProactivePersistedState>(initialPersistedState);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);
  const hadOpenRef = useRef(false);
  const fetchingRef = useRef(false);
  const showNextMutexRef = useRef(Promise.resolve());
  const userMessageCountRef = useRef(0);
  const openUserMessageCountRef = useRef(0);
  const activeTriggerRef = useRef<ProactiveTriggerType>("idle");
  const showNextRef = useRef<
    (triggerType?: ProactiveTriggerType) => Promise<void>
  >(async () => undefined);

  // Read through refs so streaming/open churn never rebuilds the schedulers.
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const busyRef = useRef(false);
  busyRef.current = isStreaming || assistantTyping;

  const persist = useCallback(() => saveProactiveState(stateRef.current), []);

  /** Bubble lifetime, floored so a bad dashboard value can't flash bubbles. */
  const displayMs = useCallback(
    () => Math.max(PROACTIVE_CONFIG.minDisplayMs, proactive.displayMs),
    [proactive.displayMs],
  );

  /** Quiet gap after a bubble closes, plus jitter so pacing feels human. */
  const gapMs = useCallback(() => {
    const base = Math.max(PROACTIVE_CONFIG.minRotateGapMs, proactive.rotateGapMs);
    const jitter = Math.max(0, proactive.rotateGapJitterMs);
    return base + Math.floor(Math.random() * (jitter + 1));
  }, [proactive.rotateGapMs, proactive.rotateGapJitterMs]);

  /** Anything left to deliver: an earned on-demand bubble, or session budget. */
  const hasWork = useCallback(
    () =>
      stateRef.current.pendingOnDemand ||
      sessionBudgetRemaining(stateRef.current) > 0 ||
      stateRef.current.suggestionQueue.items.some(
        (item) => item.source === "recent_conversation",
      ),
    [],
  );

  const getRecentMessages = useCallback(() => {
    const latestMessages = useThreadMessageStore.getState().messages;
    return latestMessages?.length
      ? latestMessages.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        }))
      : [];
  }, []);

  const hasPendingContext = useCallback(
    () =>
      hasUnreadConversationContext(
        getRecentMessages(),
        stateRef.current.lastConsumedContextFingerprint,
      ),
    [getRecentMessages],
  );

  const markContextConsumed = useCallback(() => {
    const fingerprint = messageContextFingerprint(getRecentMessages());
    if (!fingerprint) return;
    stateRef.current = {
      ...stateRef.current,
      lastConsumedContextFingerprint: fingerprint,
    };
    persist();
  }, [getRecentMessages, persist]);

  const clearTimers = useCallback(() => {
    [idleTimerRef, rotateTimerRef, hideTimerRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    });
  }, []);

  const hideBubble = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
    setActive(null);
  }, []);

  const canShow = useCallback(
    () =>
      proactiveEnabled &&
      !isOpenRef.current &&
      !visibleRef.current &&
      !busyRef.current &&
      isTabVisible(),
    [proactiveEnabled],
  );

  const scheduleNext = useCallback((delayMs: number) => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => {
      rotateTimerRef.current = null;
      void showNextRef.current("idle");
    }, delayMs);
  }, []);

  const fetchBatch = useCallback(
    async (
      mode: "idle" | "post_chat" | "fallback",
    ): Promise<ProactiveSuggestionDto[]> => {
      if (fetchingRef.current) return [];
      fetchingRef.current = true;
      try {
        const result = await fetchSuggestions({
          pagePath: pathname,
          mode,
          // Sent in every mode: the server ranks candidates against the
          // visitor's own conversation, not just the page.
          recentMessages: getRecentMessages(),
          limit:
            mode === "post_chat"
              ? ON_DEMAND_BATCH_SIZE
              : mode === "fallback"
                ? FALLBACK_BATCH_SIZE
                : Math.min(Math.max(proactive.poolLimit, 1), 20),
          excludeIds: stateRef.current.shownIds.slice(-40),
          isFirstVisit: !stateRef.current.hasVisitedBefore,
          isReturningSession:
            stateRef.current.hasVisitedBefore && isNewSessionRef.current,
        });
        if (!result.success) return [];
        const shown = new Set(stateRef.current.shownIds);
        return result.data.filter(
          (s) =>
            s?.id &&
            s?.text &&
            // Greetings reuse a fixed id every session — never filter them out.
            (s.source === "welcome" ||
              s.source === "welcome_back" ||
              !shown.has(s.id)),
        );
      } finally {
        fetchingRef.current = false;
      }
    },
    [getRecentMessages, pathname, proactive.poolLimit],
  );

  /** The reward for one completed interaction — uncapped, freshly generated. */
  const takeOnDemand =
    useCallback(async (): Promise<ProactiveSuggestionDto[]> => {
      const data = await fetchBatch("post_chat");
      // Consume the context either way so one interaction earns one bubble.
      markContextConsumed();
      return data;
    }, [fetchBatch, markContextConsumed]);

  const refillSessionQueue = useCallback(async (): Promise<boolean> => {
    let data = await fetchBatch("idle");
    if (!data.length) data = await fetchBatch("fallback");
    if (!data.length) return false;
    stateRef.current = {
      ...stateRef.current,
      suggestionQueue: enqueueSuggestions(
        stateRef.current.suggestionQueue,
        data,
      ),
      queuePagePath: pathname,
    };
    persist();
    return stateRef.current.suggestionQueue.items.length > 0;
  }, [fetchBatch, pathname, persist]);

  const takeFromQueue = useCallback((): QueuedSuggestion | null => {
    if (!stateRef.current.suggestionQueue.items.length) return null;
    const { suggestion, updatedQueue } = dequeueNextSuggestion(
      stateRef.current.suggestionQueue,
    );
    stateRef.current = {
      ...stateRef.current,
      suggestionQueue: updatedQueue,
    };
    persist();
    return suggestion;
  }, [persist]);

  const presentSuggestion = useCallback(
    (next: ActiveProactiveSuggestion, triggerType: ProactiveTriggerType) => {
      const spendsBudget = countsTowardSessionLimit(next.source);

      stateRef.current = {
        ...stateRef.current,
        shownIds: stateRef.current.shownIds.includes(next.id)
          ? stateRef.current.shownIds
          : [...stateRef.current.shownIds, next.id].slice(-MAX_SHOWN_IDS),
        hasVisitedBefore:
          stateRef.current.hasVisitedBefore ||
          next.source === "welcome" ||
          next.source === "welcome_back",
        sessionSuggestionCount: spendsBudget
          ? Math.min(
              PROACTIVE_CONFIG.sessionSuggestionLimit,
              stateRef.current.sessionSuggestionCount + 1,
            )
          : stateRef.current.sessionSuggestionCount,
        // Delivering the on-demand bubble settles the earned credit.
        pendingOnDemand: spendsBudget
          ? stateRef.current.pendingOnDemand
          : false,
      };
      if (next.source === "welcome" || next.source === "welcome_back") {
        isNewSessionRef.current = false;
      }
      persist();

      setActive(next);
      visibleRef.current = true;
      setVisible(true);

      trackProactiveTrigger({
        eventType: "shown",
        triggerType,
        pagePath: pathname,
        suggestionId: next.id,
      });

      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        visibleRef.current = false;
        setVisible(false);
        setActive(null);
        if (hasWork()) scheduleNext(gapMs());
      }, displayMs());
    },
    [displayMs, gapMs, hasWork, pathname, persist, scheduleNext],
  );

  const showNext = useCallback(
    async (triggerType: ProactiveTriggerType = "idle") => {
      let releaseMutex: () => void = () => {};
      const previous = showNextMutexRef.current;
      showNextMutexRef.current = new Promise<void>((resolve) => {
        releaseMutex = () => resolve();
      });
      await previous;

      try {
        if (!canShow()) return;
        activeTriggerRef.current = triggerType;

        // 1. An earned on-demand bubble outranks everything and ignores the cap.
        if (stateRef.current.pendingOnDemand) {
          const onDemandBatch = await takeOnDemand();
          if (!canShow()) return;
          
          if (onDemandBatch.length > 0) {
            // Force the exempt source so the cap is never charged for them.
            const VIPBatch = onDemandBatch.map(s => ({
              ...s,
              source: "recent_conversation" as const
            }));
            
            stateRef.current = {
              ...stateRef.current,
              pendingOnDemand: false,
              suggestionQueue: prependSuggestions(
                stateRef.current.suggestionQueue,
                VIPBatch
              )
            };
          } else {
            stateRef.current = { ...stateRef.current, pendingOnDemand: false };
          }
          persist();
        }

        // 2. Session cap reached — stay silent until the visitor chats again.
        // Exempt on-demand bubbles ("recent_conversation") bypass the cap.
        const nextInQueue = stateRef.current.suggestionQueue.items[0];
        const isNextExempt = nextInQueue?.source === "recent_conversation";
        if (!isNextExempt && sessionBudgetRemaining(stateRef.current) <= 0) return;

        let next = takeFromQueue();
        if (!next) {
          const refilled = await refillSessionQueue();
          if (!canShow() || !refilled) return;
          next = takeFromQueue();
        }
        if (!next) return;

        presentSuggestion(
          { id: next.id, text: next.text, source: next.source },
          triggerType,
        );
      } finally {
        releaseMutex();
      }
    },
    [
      canShow,
      persist,
      presentSuggestion,
      refillSessionQueue,
      takeFromQueue,
      takeOnDemand,
    ],
  );

  showNextRef.current = showNext;

  /**
   * Arms the next bubble. The first bubble of a session comes quickly; every
   * later one waits a full quiet gap, including after a reload or SPA nav.
   */
  const scheduleIdleShow = useCallback(() => {
    if (visibleRef.current) return;
    if (!canShow() || !hasWork()) return;
    if (idleTimerRef.current || rotateTimerRef.current) return;

    const isFirstOfSession =
      stateRef.current.sessionSuggestionCount === 0 &&
      !stateRef.current.pendingOnDemand;
    const delay = isFirstOfSession ? proactive.initialIdleMs : gapMs();

    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      void showNextRef.current("idle");
    }, delay);
  }, [canShow, gapMs, hasWork, proactive.initialIdleMs]);

  // Lock this session's budget in immediately so a reload cannot refund it.
  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    userMessageCountRef.current =
      messages?.filter((message) => message.role === "user").length ?? 0;
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
    if (!proactiveEnabled || !tabVisible) {
      clearTimers();
      hideBubble();
      return;
    }

    if (isOpen) {
      if (!hadOpenRef.current) {
        openUserMessageCountRef.current = userMessageCountRef.current;
      }
      hadOpenRef.current = true;
      clearTimers();
      hideBubble();
      return;
    }

    if (hadOpenRef.current) {
      hadOpenRef.current = false;
      clearTimers();
      const chatted =
        userMessageCountRef.current > openUserMessageCountRef.current;

      // Open → chatted → closed is one complete interaction, and every
      // interaction earns one extra personalized bubble beyond the cap.
      if (chatted && hasPendingContext()) {
        stateRef.current = { ...stateRef.current, pendingOnDemand: true };
        persist();
        scheduleNext(proactive.postChatDelayMs);
        return;
      }
      if (hasWork()) scheduleNext(gapMs());
      return;
    }

    scheduleIdleShow();
  }, [
    clearTimers,
    gapMs,
    hasPendingContext,
    hasWork,
    hideBubble,
    isOpen,
    persist,
    proactive.postChatDelayMs,
    proactiveEnabled,
    scheduleIdleShow,
    scheduleNext,
    tabVisible,
  ]);

  useEffect(() => {
    if (!pathname) return;
    if (
      stateRef.current.queuePagePath &&
      stateRef.current.queuePagePath !== pathname
    ) {
      stateRef.current = {
        ...stateRef.current,
        suggestionQueue: { items: [] },
        queuePagePath: null,
      };
      persist();
    }
    if (isOpenRef.current || !proactiveEnabled || !isTabVisible()) return;
    clearTimers();
    hideBubble();
    scheduleIdleShow();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => clearTimers, [clearTimers]);

  const dismissActive = useCallback(() => {
    if (active) {
      trackProactiveTrigger({
        eventType: "dismissed",
        triggerType: activeTriggerRef.current,
        pagePath: pathname,
        suggestionId: active.id,
      });
    }
    clearTimers();
    hideBubble();
    if (hasWork()) scheduleNext(gapMs());
  }, [active, clearTimers, gapMs, hasWork, hideBubble, pathname, scheduleNext]);

  const clickActive = useCallback(() => {
    if (active) {
      trackProactiveTrigger({
        eventType: "clicked",
        triggerType: activeTriggerRef.current,
        pagePath: pathname,
        suggestionId: active.id,
      });
    }
  }, [active, pathname]);

  return {
    active,
    visible:
      proactiveEnabled && tabVisible && visible && !isOpen && Boolean(active),
    dismissActive,
    clickActive,
  };
}
