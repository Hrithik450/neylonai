"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSuggestions,
  getOrCreateSessionId,
  getTrackedPageSection,
  subscribeToPageSection,
  subscribeToQualifiedPageSection,
  trackProactiveTrigger,
  type ProactiveSuggestionDto,
  type ProactiveTriggerType,
  type TrackedPageSection,
} from "../..";
import { useWidgetToggleStore, useWidgetStore } from "../store/widget-store";
import { useThreadMessageStore } from "../store/thread-store";
import { useWidgetHost } from "../context/widget-host";
import { PROACTIVE_CONFIG } from "./config";
import {
  claimProactiveSessionBatch,
  isPageVisitComplete,
  loadProactiveState,
  markSectionSuggestionShown,
  pickNextSuggestion,
  saveProactiveState,
  unshownSectionKeysForPath,
  type ProactivePersistedState,
} from "./persistence";
import {
  hasTriggerCooldownExpired,
  markTriggerFired,
} from "./trigger-state";

const SESSION_SUGGESTION_LIMIT = PROACTIVE_CONFIG.sessionSuggestionLimit;

function isReloadNavigation(): boolean {
  if (typeof performance === "undefined") return false;
  const [navigation] = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  return navigation?.type === "reload";
}

function isPageInteractionActive(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    (active.matches("input, textarea, select, [contenteditable='true']") ||
      active.closest("[role='dialog']"))
  ) {
    return true;
  }
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}

export interface ActiveProactiveSuggestion {
  id: string;
  text: string;
  source: ProactiveSuggestionDto["source"];
}

const isTabVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

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
  const [pageSection, setPageSection] = useState<TrackedPageSection | null>(
    getTrackedPageSection,
  );
  const [qualifiedSection, setQualifiedSection] =
    useState<TrackedPageSection | null>(null);
  const [lifecycleVersion, setLifecycleVersion] = useState(0);

  const sessionIdRef = useRef(getOrCreateSessionId());
  const sessionBatchActiveRef = useRef<boolean | null>(null);
  const reloadDocumentRef = useRef(isReloadNavigation());
  const [initialPersistedState] = useState<ProactivePersistedState>(() => {
    const state = loadProactiveState();
    // The budget is what limits a session, so claiming has to know how much of
    // it this session already spent.
    const sameSession = state.sessionBatchId === sessionIdRef.current;
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
  const pageSectionRef = useRef<TrackedPageSection | null>(pageSection);
  pageSectionRef.current = pageSection;
  const qualifiedSectionRef = useRef<TrackedPageSection | null>(qualifiedSection);
  qualifiedSectionRef.current = qualifiedSection;
  const knownSectionKeysRef = useRef<string[]>([]);
  knownSectionKeysRef.current = [];
  const sectionScopeKey = pageSection
    ? `${pathname ?? "/"}:${pageSection.sectionId}`
    : null;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadOpenRef = useRef(false);
  const fetchingRef = useRef(false);
  const hasChattedRef = useRef(false);
  const postChatPendingRef = useRef(false);
  const userMessageCountRef = useRef(0);
  const openUserMessageCountRef = useRef(0);
  const activeTriggerRef = useRef<ProactiveTriggerType>("idle");
  const showNextRef = useRef<(triggerType?: ProactiveTriggerType) => Promise<void>>(async () => undefined);

  const persist = useCallback(() => saveProactiveState(stateRef.current), []);

  /** A refresh stays inside the tab session, so unspent bubbles still owed. */
  const sessionBatchPending = useCallback(
    () =>
      Boolean(sessionBatchActiveRef.current) &&
      stateRef.current.sessionBatchId === sessionIdRef.current &&
      stateRef.current.sessionSuggestionCount < SESSION_SUGGESTION_LIMIT,
    [],
  );

  const clearTimers = useCallback(() => {
    [idleTimerRef, rotateTimerRef, hideTimerRef].forEach(ref => {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    });
  }, []);

  const hideBubble = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
    setActive(null);
  }, []);

  const canShow = useCallback(() =>
    proactiveEnabled &&
    !isOpen &&
    !visibleRef.current &&
    !isStreaming &&
    !assistantTyping &&
    !isPageInteractionActive() &&
    isTabVisible(),
    [assistantTyping, isOpen, isStreaming, proactiveEnabled]
  );

  const triggerAllowed = useCallback(
    (triggerType: ProactiveTriggerType): boolean => {
      return hasTriggerCooldownExpired(
        triggerType,
        pathname,
        0,
        undefined,
        sectionScopeKey,
      );
    },
    [pathname, sectionScopeKey],
  );

  const refreshPool = useCallback(
    async (
      mode: "idle" | "post_chat",
      triggerType: ProactiveTriggerType,
      section: TrackedPageSection | null,
      options?: { sessionBatch?: boolean },
    ) => {
      if (fetchingRef.current) return false;
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

        const knownKeys = knownSectionKeysRef.current;
        const visitComplete =
          pathname != null &&
          isPageVisitComplete(stateRef.current, pathname, knownKeys);
        const unshownSectionKeys =
          options?.sessionBatch &&
          pathname &&
          !visitComplete
            ? unshownSectionKeysForPath(
                stateRef.current,
                pathname,
                knownKeys,
              )
            : undefined;

        const result = await fetchSuggestions({
          pagePath: pathname,
          pageSection: section,
          mode,
          triggerType,
          recentMessages,
          limit: Math.min(Math.max(proactive.poolLimit, 4), 5),
          excludeIds: stateRef.current.shownIds.slice(-24),
          unshownSectionKeys,
        });

        if (result.success && result.data.length > 0) {
          stateRef.current = {
            ...stateRef.current,
            pool: result.data,
            poolPagePath: pathname,
            poolSectionKey: section?.sectionId ?? null,
            poolMode: mode,
            poolFetchedAt: Date.now(),
          };
          persist();
          setLifecycleVersion((version) => version + 1);
        }
        return result.success;
      } finally {
        fetchingRef.current = false;
      }
    },
    [pathname, persist, proactive.poolLimit],
  );

  const scheduleNext = useCallback((delayMs: number) => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => {
      void showNextRef.current("idle");
    }, delayMs);
  }, []);

  const showNext = useCallback(
    async (triggerType: ProactiveTriggerType = "idle") => {
      if (!canShow()) return;
      activeTriggerRef.current = triggerType;

      const knownKeys = knownSectionKeysRef.current;
      const visitComplete =
        pathname != null &&
        isPageVisitComplete(stateRef.current, pathname, knownKeys);

      const mode =
        hasChattedRef.current && postChatPendingRef.current
          ? "post_chat"
          : "idle";
      const showingSessionBatch = mode === "idle" && sessionBatchPending();
      const isPostChat = mode === "post_chat";
      if (
        mode === "idle" &&
        reloadDocumentRef.current &&
        !showingSessionBatch
      ) {
        return;
      }
      const targetSection =
        showingSessionBatch || visitComplete ? null : qualifiedSection;
      const targetSectionScope = targetSection
        ? `${pathname ?? "/"}:${targetSection.sectionId}`
        : null;

      if (
        !showingSessionBatch &&
        !isPostChat &&
        (visitComplete ||
          !targetSection ||
          !targetSectionScope ||
          stateRef.current.shownSectionKeys.includes(targetSectionScope))
      ) {
        return;
      }

      const poolAge = Date.now() - stateRef.current.poolFetchedAt;
      const pathChanged = stateRef.current.poolPagePath !== pathname;
      const modeChanged = stateRef.current.poolMode !== mode;
      const sectionChanged =
        stateRef.current.poolSectionKey !== (targetSection?.sectionId ?? null);
      const needRefresh =
        isPostChat ||
        stateRef.current.pool.length === 0 ||
        pathChanged ||
        modeChanged ||
        sectionChanged ||
        poolAge > PROACTIVE_CONFIG.poolTtlMs;

      const poolReady = needRefresh
        ? await refreshPool(mode, triggerType, targetSection, {
            sessionBatch: showingSessionBatch,
          })
        : true;

      if (!canShow()) return;
      if (
        targetSection &&
        qualifiedSectionRef.current?.sectionId !== targetSection.sectionId
      ) {
        return;
      }

      const eligiblePool = showingSessionBatch
        ? stateRef.current.pool.filter((suggestion) => {
            if (
              suggestion.source === "recent_conversation" ||
              suggestion.source === "conversation_history"
            ) {
              return false;
            }
            // After all sections explored, session batches are FAQ/general only.
            if (visitComplete && suggestion.source === "section") return false;
            return true;
          })
        : isPostChat
          ? stateRef.current.pool.filter(
              (suggestion) =>
                suggestion.source === "recent_conversation" ||
                suggestion.source === "conversation_history",
            )
          : stateRef.current.pool.filter(
              (suggestion) =>
                suggestion.source === "section" &&
                suggestion.contextKey === targetSection?.sectionId,
            );
      const next = pickNextSuggestion(
        eligiblePool,
        stateRef.current,
        pathname,
        {
          preferWelcome:
            Boolean(showingSessionBatch) && !stateRef.current.welcomeShown,
        },
      );

      if (!next) {
        if (isPostChat) postChatPendingRef.current = false;
        if (showingSessionBatch) {
          stateRef.current = {
            ...stateRef.current,
            sessionSuggestionCount: SESSION_SUGGESTION_LIMIT,
          };
          persist();
        } else if (
          !isPostChat &&
          poolReady &&
          targetSectionScope &&
          targetSection &&
          !stateRef.current.shownSectionKeys.includes(targetSectionScope)
        ) {
          const sectionPoolSize = stateRef.current.pool.filter(
            (s) => s.source === "section" && s.contextKey === targetSection.sectionId,
          ).length;
          stateRef.current = markSectionSuggestionShown(
            stateRef.current,
            pathname ?? "/",
            targetSection.sectionId,
            knownSectionKeysRef.current,
            Math.max(1, sectionPoolSize),
          );
          persist();
        }
        return;
      }

      let nextState: ProactivePersistedState = {
        ...stateRef.current,
        shownIds: stateRef.current.shownIds.includes(next.id)
          ? stateRef.current.shownIds
          : [...stateRef.current.shownIds, next.id],
        welcomeShown:
          stateRef.current.welcomeShown || next.source === "welcome",
        sessionSuggestionCount:
          showingSessionBatch && next.source !== "welcome"
            ? Math.min(
                SESSION_SUGGESTION_LIMIT,
                stateRef.current.sessionSuggestionCount + 1,
              )
            : stateRef.current.sessionSuggestionCount,
      };

      if (
        next.source === "section" &&
        pathname &&
        next.contextKey
      ) {
        const sectionPoolSize = stateRef.current.pool.filter(
          (s) => s.source === "section" && s.contextKey === next.contextKey,
        ).length;
        nextState = markSectionSuggestionShown(
          nextState,
          pathname,
          next.contextKey,
          knownSectionKeysRef.current,
          Math.max(1, sectionPoolSize),
        );
      }

      stateRef.current = nextState;
      if (isPostChat) postChatPendingRef.current = false;
      persist();
      setLifecycleVersion((version) => version + 1);

      setActive({ id: next.id, text: next.text, source: next.source });
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
        if (sessionBatchPending()) {
          scheduleNext(proactive.rotateGapMs);
        }
      }, proactive.displayMs);
    },
    [canShow, pathname, persist, proactive.displayMs, proactive.rotateGapMs, qualifiedSection, refreshPool, scheduleNext, sessionBatchPending],
  );

  showNextRef.current = showNext;

  const scheduleIdleShow = useCallback(() => {
    clearTimers();
    if (!canShow() || !triggerAllowed("idle")) return;
    idleTimerRef.current = setTimeout(() => {
      markTriggerFired("idle", pathname, undefined, sectionScopeKey);
      void showNextRef.current("idle");
    }, proactive.initialIdleMs);
  }, [canShow, clearTimers, pathname, proactive.initialIdleMs, sectionScopeKey, showNext, triggerAllowed]);

  useEffect(() => {
    const userMessageCount =
      messages?.filter((message) => message.role === "user").length ?? 0;
    userMessageCountRef.current = userMessageCount;
    hasChattedRef.current = userMessageCount > 0;
  }, [messages]);

  useEffect(() => {
    setPageSection(getTrackedPageSection());
    return subscribeToPageSection(() => {
      setPageSection(getTrackedPageSection());
      hideBubble();
      clearTimers();
    });
  }, [clearTimers, hideBubble, pathname]);

  useEffect(() => {
    return subscribeToQualifiedPageSection((section) => {
      setQualifiedSection(section);
      hideBubble();
      clearTimers();
    });
  }, [clearTimers, hideBubble]);

  /** Fetch on-demand seeds for qualified sections (runs alongside session batch). */
  useEffect(() => {
    if (
      !proactiveEnabled ||
      !tabVisible ||
      isOpen ||
      !qualifiedSection ||
      !pathname
    ) {
      return;
    }
    if (isPageVisitComplete(stateRef.current, pathname, knownSectionKeysRef.current)) {
      return;
    }
    const scope = `${pathname}:${qualifiedSection.sectionId}`;
    if (stateRef.current.shownSectionKeys.includes(scope)) return;
    void showNextRef.current("dwell");
  }, [
    isOpen,
    lifecycleVersion,
    pathname,
    proactiveEnabled,
    qualifiedSection,
    tabVisible,
  ]);

  useEffect(() => {
    const onScroll = () => {
      if (active) hideBubble();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
      scheduleNext(proactive.initialIdleMs);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [active, hideBubble, proactive.initialIdleMs, scheduleNext]);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      !target.closest("[data-neylonai-widget], [data-proactive-suggestion]") &&
      Boolean(
        target.closest(
          "a, button, input, textarea, select, [contenteditable='true'], [role='button'], [role='dialog'], video, audio",
        ),
      );
    const pauseForInteraction = (event: Event) => {
      if (!isInteractiveTarget(event.target)) return;
      clearTimers();
      hideBubble();
    };
    const resumeAfterInteraction = () => {
      scheduleNext(proactive.initialIdleMs);
    };

    document.addEventListener("pointerdown", pauseForInteraction, true);
    document.addEventListener("keydown", pauseForInteraction, true);
    document.addEventListener("focusout", resumeAfterInteraction, true);
    return () => {
      document.removeEventListener("pointerdown", pauseForInteraction, true);
      document.removeEventListener("keydown", pauseForInteraction, true);
      document.removeEventListener("focusout", resumeAfterInteraction, true);
    };
  }, [clearTimers, hideBubble, proactive.initialIdleMs, scheduleNext]);

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
    if (!proactiveEnabled || !tabVisible || isOpen) return;
    if (
      reloadDocumentRef.current &&
      !hasChattedRef.current &&
      !sessionBatchPending()
    ) {
      return;
    }
    const sessionBatchComplete = !sessionBatchPending();
    const visitComplete =
      pathname != null &&
      isPageVisitComplete(
        stateRef.current,
        pathname,
        knownSectionKeysRef.current,
      );
    if (sessionBatchComplete && visitComplete) {
      return;
    }
    if (
      sessionBatchComplete &&
      (!sectionScopeKey ||
        stateRef.current.shownSectionKeys.includes(sectionScopeKey))
    ) {
      return;
    }
  }, [
    isOpen,
    lifecycleVersion,
    pathname,
    proactiveEnabled,
    sectionScopeKey,
    tabVisible,
  ]);

  useEffect(() => {
    if (!proactiveEnabled || !tabVisible) { clearTimers(); hideBubble(); return; }

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
      postChatPendingRef.current =
        userMessageCountRef.current > openUserMessageCountRef.current;
      clearTimers();
      if (!postChatPendingRef.current) return;
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
    proactiveEnabled,
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
  }, [active, hideBubble, pathname]);

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
      proactiveEnabled &&
      tabVisible &&
      visible &&
      !isOpen &&
      Boolean(active),
    dismissActive,
    clickActive,
  };
}
