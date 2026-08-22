"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSuggestions,
  getOrCreateSessionId,
  trackProactiveTrigger,
  type ProactiveSuggestionDto,
  type ProactiveTriggerType,
} from "../..";
import { useWidgetToggleStore, useWidgetStore } from "../store/widget-store";
import { useThreadMessageStore } from "../store/thread-store";
import { useWidgetHost } from "../context/widget-host";
import { PROACTIVE_CONFIG } from "./config";
import {
  claimProactiveSessionBatch,
  countsTowardSessionLimit,
  loadProactiveState,
  saveProactiveState,
  type ProactivePersistedState,
} from "./persistence";
import { dequeueNextSuggestion, enqueueSuggestions } from "./suggestion-queue";
import {
  hasUnreadConversationContext,
  messageContextFingerprint,
} from "./context-fingerprint";
import { hasTriggerCooldownExpired, markTriggerFired } from "./trigger-state";

const SESSION_SUGGESTION_LIMIT = PROACTIVE_CONFIG.sessionSuggestionLimit;
const FALLBACK_BATCH_SIZE = 5;
const POST_CHAT_BATCH_SIZE = 2;

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

  const sessionIdRef = useRef(getOrCreateSessionId());
  const sessionBatchActiveRef = useRef<boolean | null>(null);
  const isNewSessionRef = useRef(false);

  const [initialPersistedState] = useState<ProactivePersistedState>(() => {
    const state = loadProactiveState();
    const sameSession = state.sessionBatchId === sessionIdRef.current;
    isNewSessionRef.current = !sameSession;
    const spent = sameSession ? state.sessionSuggestionCount : 0;
    sessionBatchActiveRef.current = claimProactiveSessionBatch(
      sessionIdRef.current,
      SESSION_SUGGESTION_LIMIT - spent,
    );
    if (sessionBatchActiveRef.current && !sameSession) {
      const next = {
        ...state,
        sessionBatchId: sessionIdRef.current,
        sessionSuggestionCount: 0,
      };
      saveProactiveState(next);
      return next;
    }
    return state;
  });

  if (sessionBatchActiveRef.current === null) {
    sessionBatchActiveRef.current = false;
  }

  const stateRef = useRef<ProactivePersistedState>(initialPersistedState);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadOpenRef = useRef(false);
  const fetchingRef = useRef(false);
  const showNextMutexRef = useRef(Promise.resolve());
  const userMessageCountRef = useRef(0);
  const openUserMessageCountRef = useRef(0);
  const activeTriggerRef = useRef<ProactiveTriggerType>("idle");
  const postChatPendingRef = useRef(false);
  const showNextRef = useRef<
    (triggerType?: ProactiveTriggerType) => Promise<void>
  >(async () => undefined);

  const persist = useCallback(() => saveProactiveState(stateRef.current), []);

  const sessionBatchPending = useCallback(
    () =>
      Boolean(sessionBatchActiveRef.current) &&
      stateRef.current.sessionBatchId === sessionIdRef.current &&
      stateRef.current.sessionSuggestionCount < SESSION_SUGGESTION_LIMIT,
    [],
  );

  const queueHasItems = useCallback(
    () => stateRef.current.suggestionQueue.items.length > 0,
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

  const hasPendingContext = useCallback(() => {
    return hasUnreadConversationContext(
      getRecentMessages(),
      stateRef.current.lastConsumedContextFingerprint,
    );
  }, [getRecentMessages]);

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
      !isOpen &&
      !visibleRef.current &&
      !isStreaming &&
      !assistantTyping &&
      isTabVisible(),
    [assistantTyping, isOpen, isStreaming, proactiveEnabled],
  );

  const triggerAllowed = useCallback(
    (triggerType: ProactiveTriggerType): boolean => {
      return hasTriggerCooldownExpired(triggerType, pathname, 0);
    },
    [pathname],
  );

  const scheduleNext = useCallback((delayMs: number) => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => {
      void showNextRef.current("idle");
    }, delayMs);
  }, []);

  const fetchAndEnqueue = useCallback(
    async (mode: "idle" | "post_chat" | "fallback") => {
      if (fetchingRef.current) return false;
      fetchingRef.current = true;
      try {
        const recentMessages = getRecentMessages();
        const excludeIds = stateRef.current.shownIds.slice(-40);

        const result = await fetchSuggestions({
          pagePath: pathname,
          mode,
          recentMessages: mode === "post_chat" ? recentMessages : undefined,
          limit:
            mode === "post_chat"
              ? POST_CHAT_BATCH_SIZE
              : mode === "fallback"
                ? FALLBACK_BATCH_SIZE
                : Math.min(Math.max(proactive.poolLimit, 4), 5),
          excludeIds,
          isFirstVisit: !stateRef.current.hasVisitedBefore,
          isReturningSession:
            stateRef.current.hasVisitedBefore && isNewSessionRef.current,
        });

        if (result.success && result.data.length > 0) {
          if (mode === "post_chat") {
            markContextConsumed();
          }
          stateRef.current = {
            ...stateRef.current,
            suggestionQueue: enqueueSuggestions(
              stateRef.current.suggestionQueue,
              result.data,
            ),
            queuePagePath: pathname,
          };
          persist();
          return true;
        }
        return false;
      } finally {
        fetchingRef.current = false;
      }
    },
    [
      getRecentMessages,
      markContextConsumed,
      pathname,
      persist,
      proactive.poolLimit,
    ],
  );

  const refillQueue = useCallback(async () => {
    if (postChatPendingRef.current || hasPendingContext()) {
      const fetched = await fetchAndEnqueue("post_chat");
      postChatPendingRef.current = false;
      return fetched;
    }
    return fetchAndEnqueue("fallback");
  }, [fetchAndEnqueue, hasPendingContext]);

  const presentSuggestion = useCallback(
    (
      next: ActiveProactiveSuggestion,
      triggerType: ProactiveTriggerType,
      options: { countsTowardLimit: boolean },
    ) => {
      const nextState: ProactivePersistedState = {
        ...stateRef.current,
        shownIds: stateRef.current.shownIds.includes(next.id)
          ? stateRef.current.shownIds
          : [...stateRef.current.shownIds, next.id],
        hasVisitedBefore:
          stateRef.current.hasVisitedBefore || next.source === "welcome",
        sessionSuggestionCount:
          options.countsTowardLimit && countsTowardSessionLimit(next.source)
            ? Math.min(
                SESSION_SUGGESTION_LIMIT,
                stateRef.current.sessionSuggestionCount + 1,
              )
            : stateRef.current.sessionSuggestionCount,
      };

      stateRef.current = nextState;
      if (next.source === "welcome" || next.source === "welcome_back") {
        isNewSessionRef.current = false;
      }
      persist();

      setActive({
        id: next.id,
        text: next.text,
        source: next.source,
      });
      visibleRef.current = true;
      setVisible(true);

      trackProactiveTrigger({
        eventType: "shown",
        triggerType,
        pagePath: pathname,
        suggestionId: next.id,
      });

      hideTimerRef.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
        setActive(null);
        scheduleNext(proactive.rotateGapMs);
      }, proactive.displayMs);
    },
    [
      pathname,
      persist,
      proactive.displayMs,
      proactive.rotateGapMs,
      queueHasItems,
      scheduleNext,
      sessionBatchPending,
    ],
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

        if (queueHasItems()) {
          const { suggestion, updatedQueue } = dequeueNextSuggestion(
            stateRef.current.suggestionQueue,
          );
          stateRef.current = {
            ...stateRef.current,
            suggestionQueue: updatedQueue,
          };
          persist();

          if (suggestion) {
            presentSuggestion(
              {
                id: suggestion.id,
                text: suggestion.text,
                source: suggestion.source,
              },
              triggerType,
              {
                countsTowardLimit: sessionBatchPending(),
              },
            );
            return;
          }
        }

        if (postChatPendingRef.current) {
          const fetched = await refillQueue();
          if (!canShow() || !fetched) return;
          void showNextRef.current(triggerType);
          return;
        }

        if (sessionBatchPending()) {
          const fetched = await fetchAndEnqueue("idle");
          if (!canShow()) return;
          if (fetched && queueHasItems()) {
            void showNextRef.current(triggerType);
          } else if (!queueHasItems()) {
            stateRef.current = {
              ...stateRef.current,
              sessionSuggestionCount: SESSION_SUGGESTION_LIMIT,
            };
            persist();
            const refilled = await refillQueue();
            if (canShow() && refilled && queueHasItems()) {
              void showNextRef.current(triggerType);
            }
          }
          return;
        }

        const fetched = await refillQueue();
        if (!canShow() || !fetched) return;
        if (queueHasItems()) {
          void showNextRef.current(triggerType);
        }
      } finally {
        releaseMutex();
      }
    },
    [
      canShow,
      fetchAndEnqueue,
      persist,
      presentSuggestion,
      queueHasItems,
      refillQueue,
      sessionBatchPending,
    ],
  );

  showNextRef.current = showNext;

  const scheduleIdleShow = useCallback(() => {
    clearTimers();
    if (!canShow() || !triggerAllowed("idle")) return;
    idleTimerRef.current = setTimeout(() => {
      markTriggerFired("idle", pathname);
      void showNextRef.current("idle");
    }, proactive.initialIdleMs);
  }, [canShow, clearTimers, pathname, proactive.initialIdleMs, triggerAllowed]);

  useEffect(() => {
    const userMessageCount =
      messages?.filter((message) => message.role === "user").length ?? 0;
    userMessageCountRef.current = userMessageCount;
  }, [messages]);

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
      hideBubble();
      clearTimers();
    }
  }, [clearTimers, hideBubble, pathname, persist]);

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
      const chatted =
        userMessageCountRef.current > openUserMessageCountRef.current;
      postChatPendingRef.current = chatted;
      clearTimers();
      if (!chatted) {
        scheduleNext(proactive.rotateGapMs);
        return;
      }
      idleTimerRef.current = setTimeout(() => {
        void showNextRef.current("idle");
      }, proactive.postChatDelayMs);
      return;
    }

    scheduleIdleShow();
  }, [
    clearTimers,
    hideBubble,
    isOpen,
    proactive.postChatDelayMs,
    proactive.rotateGapMs,
    proactiveEnabled,
    queueHasItems,
    scheduleIdleShow,
    scheduleNext,
    sessionBatchPending,
    hasPendingContext,
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

  const dismissActive = useCallback(() => {
    if (active) {
      trackProactiveTrigger({
        eventType: "dismissed",
        triggerType: activeTriggerRef.current,
        pagePath: pathname,
        suggestionId: active.id,
      });
    }
    hideBubble();
    scheduleNext(proactive.rotateGapMs);
  }, [active, hideBubble, pathname, proactive.rotateGapMs, scheduleNext]);

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
