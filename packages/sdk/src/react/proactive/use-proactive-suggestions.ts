"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSuggestions,
  getOrCreateSessionId,
  getRegisteredPageSections,
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
  isSectionFullyShown,
  loadProactiveState,
  markSectionSuggestionShown,
  mergeKnownSectionKeys,
  recordSectionSuggestionTotals,
  saveProactiveState,
  unshownSectionKeysForPath,
  type ProactivePersistedState,
} from "./persistence";
import {
  dequeueNextSuggestion,
  enqueueSectionSuggestions,
  enqueueSessionSuggestions,
  isSectionQueueLocked,
  nextPendingFetchSectionKey,
  requestSectionFetch,
  shiftPendingFetchSectionKey,
} from "./suggestion-queue";
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
  sectionKey?: string;
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
  knownSectionKeysRef.current = pathname
    ? getRegisteredPageSections(pathname)
    : [];

  useEffect(() => {
    if (!pathname) return;
    const registered = getRegisteredPageSections(pathname);
    if (!registered.length) return;
    const merged = mergeKnownSectionKeys(
      stateRef.current,
      pathname,
      registered,
    );
    if (merged !== stateRef.current) {
      stateRef.current = merged;
      saveProactiveState(merged);
    }
  }, [pathname]);
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
  const showNextRef = useRef<(triggerType?: ProactiveTriggerType) => Promise<void>>(
    async () => undefined,
  );

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
      !isPageInteractionActive() &&
      isTabVisible(),
    [assistantTyping, isOpen, isStreaming, proactiveEnabled],
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

  const scheduleNext = useCallback((delayMs: number) => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => {
      void showNextRef.current("idle");
    }, delayMs);
  }, []);

  const enqueueFetchedSuggestions = useCallback(
    (
      data: ProactiveSuggestionDto[],
      mode: "idle" | "post_chat",
      section: TrackedPageSection | null,
      sessionBatch: boolean,
    ) => {
      if (mode === "post_chat") {
        stateRef.current = {
          ...stateRef.current,
          pool: data,
          poolPagePath: pathname,
          poolSectionKey: section?.sectionId ?? null,
          poolMode: mode,
          poolFetchedAt: Date.now(),
        };
        return;
      }

      if (section) {
        stateRef.current = {
          ...stateRef.current,
          suggestionQueue: enqueueSectionSuggestions(
            stateRef.current.suggestionQueue,
            section.sectionId,
            data.filter((s) => s.source === "section"),
          ),
          pool: data,
          poolPagePath: pathname,
          poolSectionKey: section.sectionId,
          poolMode: mode,
          poolFetchedAt: Date.now(),
        };
        return;
      }

      if (sessionBatch) {
        const visitComplete =
          pathname != null &&
          isPageVisitComplete(
            stateRef.current,
            pathname,
            knownSectionKeysRef.current,
          );
        const batchItems = data.filter((suggestion) => {
          if (
            suggestion.source === "recent_conversation" ||
            suggestion.source === "conversation_history"
          ) {
            return false;
          }
          if (visitComplete && suggestion.source === "section") return false;
          return true;
        });
        stateRef.current = {
          ...stateRef.current,
          suggestionQueue: enqueueSessionSuggestions(
            stateRef.current.suggestionQueue,
            batchItems,
          ),
          pool: data,
          poolPagePath: pathname,
          poolSectionKey: null,
          poolMode: mode,
          poolFetchedAt: Date.now(),
        };
        return;
      }

      stateRef.current = {
        ...stateRef.current,
        pool: data,
        poolPagePath: pathname,
        poolSectionKey: null,
        poolMode: mode,
        poolFetchedAt: Date.now(),
      };
    },
    [pathname],
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
          options?.sessionBatch && pathname && !visitComplete
            ? unshownSectionKeysForPath(stateRef.current, pathname, knownKeys)
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
          if (section && result.sectionState?.sectionKey) {
            stateRef.current = recordSectionSuggestionTotals(
              stateRef.current,
              pathname ?? "/",
              result.sectionState.sectionKey,
              result.sectionState.total,
            );
          }
          enqueueFetchedSuggestions(
            result.data,
            mode,
            section,
            Boolean(options?.sessionBatch),
          );
          persist();
          setLifecycleVersion((version) => version + 1);
        } else if (
          section &&
          result.sectionState &&
          result.sectionState.total > 0
        ) {
          stateRef.current = recordSectionSuggestionTotals(
            stateRef.current,
            pathname ?? "/",
            result.sectionState.sectionKey,
            result.sectionState.total,
          );
          persist();
        }
        return result.success;
      } finally {
        fetchingRef.current = false;
      }
    },
    [enqueueFetchedSuggestions, pathname, persist, proactive.poolLimit],
  );

  const presentSuggestion = useCallback(
    (
      next: {
        id: string;
        text: string;
        source: ProactiveSuggestionDto["source"];
        sectionKey?: string;
      },
      triggerType: ProactiveTriggerType,
      options: { sessionBatch: boolean; postChat: boolean },
    ) => {
      let nextState: ProactivePersistedState = {
        ...stateRef.current,
        shownIds: stateRef.current.shownIds.includes(next.id)
          ? stateRef.current.shownIds
          : [...stateRef.current.shownIds, next.id],
        welcomeShown:
          stateRef.current.welcomeShown || next.source === "welcome",
        sessionSuggestionCount:
          options.sessionBatch && next.source !== "welcome"
            ? Math.min(
                SESSION_SUGGESTION_LIMIT,
                stateRef.current.sessionSuggestionCount + 1,
              )
            : stateRef.current.sessionSuggestionCount,
      };

      if (next.source === "section" && pathname && next.sectionKey) {
        const sectionPoolSize = Math.max(
          1,
          stateRef.current.pool.filter(
            (s) => s.source === "section" && s.contextKey === next.sectionKey,
          ).length,
        );
        nextState = markSectionSuggestionShown(
          nextState,
          pathname,
          next.sectionKey,
          knownSectionKeysRef.current,
          sectionPoolSize,
        );
      }

      stateRef.current = nextState;
      if (options.postChat) postChatPendingRef.current = false;
      persist();
      setLifecycleVersion((version) => version + 1);

      setActive({
        id: next.id,
        text: next.text,
        source: next.source,
        sectionKey: next.sectionKey,
      });
      visibleRef.current = true;
      setVisible(true);

      trackProactiveTrigger({
        eventType: "shown",
        triggerType,
        pagePath: pathname,
        suggestionId: next.id,
        metadata: next.sectionKey
          ? { sectionKey: next.sectionKey }
          : undefined,
      });

      hideTimerRef.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
        setActive(null);
        if (queueHasItems() || sessionBatchPending()) {
          scheduleNext(proactive.rotateGapMs);
        }
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
        !showingSessionBatch &&
        !queueHasItems()
      ) {
        return;
      }

      // Post-chat follow-ups bypass the FIFO queue.
      if (isPostChat) {
        const poolReady = await refreshPool(mode, triggerType, qualifiedSection);
        if (!canShow() || !poolReady) return;
        const eligible = stateRef.current.pool.filter(
          (suggestion) =>
            suggestion.source === "recent_conversation" ||
            suggestion.source === "conversation_history",
        );
        const next = eligible.find(
          (s) => !stateRef.current.shownIds.includes(s.id),
        );
        if (!next) {
          postChatPendingRef.current = false;
          return;
        }
        presentSuggestion(
          {
            id: next.id,
            text: next.text,
            source: next.source,
            sectionKey: next.contextKey,
          },
          triggerType,
          { sessionBatch: false, postChat: true },
        );
        return;
      }

      // Drain queued items first (section → session FIFO with section lock).
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
              sectionKey: suggestion.sectionKey,
            },
            triggerType,
            {
              sessionBatch: suggestion.priority === "session",
              postChat: false,
            },
          );
          return;
        }
      }

      // Process a section fetch that was deferred while another section was locked.
      const pendingFetchKey = nextPendingFetchSectionKey(
        stateRef.current.suggestionQueue,
      );
      if (pendingFetchKey && !isSectionQueueLocked(stateRef.current.suggestionQueue)) {
        stateRef.current = {
          ...stateRef.current,
          suggestionQueue: shiftPendingFetchSectionKey(
            stateRef.current.suggestionQueue,
          ),
        };
        persist();
        const pendingSection: TrackedPageSection = {
          sectionId: pendingFetchKey,
          pagePath: pathname ?? "/",
        };
        const fetched = await refreshPool("idle", "dwell", pendingSection);
        if (fetched && queueHasItems() && canShow()) {
          void showNextRef.current(triggerType);
        }
        return;
      }

      const targetSection =
        showingSessionBatch || visitComplete ? null : qualifiedSection;
      const targetSectionScope = targetSection
        ? `${pathname ?? "/"}:${targetSection.sectionId}`
        : null;

      if (targetSection) {
        const fetchDecision = requestSectionFetch(
          stateRef.current.suggestionQueue,
          targetSection.sectionId,
        );
        stateRef.current = {
          ...stateRef.current,
          suggestionQueue: fetchDecision.queue,
        };
        persist();

        if (!fetchDecision.shouldFetch) {
          // Locked to another section — wait for queue drain.
          if (queueHasItems()) {
            void showNextRef.current(triggerType);
          }
          return;
        }

        if (
          targetSection &&
          isSectionFullyShown(
            stateRef.current,
            pathname ?? "/",
            targetSection.sectionId,
          )
        ) {
          return;
        }

        const fetched = await refreshPool("idle", triggerType, targetSection);
        if (!canShow()) return;
        if (
          qualifiedSectionRef.current?.sectionId !== targetSection.sectionId &&
          isSectionQueueLocked(stateRef.current.suggestionQueue) &&
          stateRef.current.suggestionQueue.lockedSectionKey !==
            targetSection.sectionId
        ) {
          return;
        }
        if (fetched && queueHasItems()) {
          void showNextRef.current(triggerType);
        }
        return;
      }

      if (showingSessionBatch) {
        const fetched = await refreshPool("idle", triggerType, null, {
          sessionBatch: true,
        });
        if (!canShow()) return;
        if (fetched && queueHasItems()) {
          void showNextRef.current(triggerType);
        } else if (!queueHasItems()) {
          stateRef.current = {
            ...stateRef.current,
            sessionSuggestionCount: SESSION_SUGGESTION_LIMIT,
          };
          persist();
        }
        return;
      }
    },
    [
      canShow,
      pathname,
      persist,
      presentSuggestion,
      qualifiedSection,
      queueHasItems,
      refreshPool,
      sessionBatchPending,
    ],
  );

  showNextRef.current = showNext;

  const scheduleIdleShow = useCallback(() => {
    clearTimers();
    if (!canShow() || !triggerAllowed("idle")) return;
    idleTimerRef.current = setTimeout(() => {
      markTriggerFired("idle", pathname, undefined, sectionScopeKey);
      void showNextRef.current("idle");
    }, proactive.initialIdleMs);
  }, [
    canShow,
    clearTimers,
    pathname,
    proactive.initialIdleMs,
    sectionScopeKey,
    triggerAllowed,
  ]);

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
      // Keep locked-section bubbles; only clear when nothing is draining.
      if (!isSectionQueueLocked(stateRef.current.suggestionQueue)) {
        hideBubble();
        clearTimers();
      }
    });
  }, [clearTimers, hideBubble, pathname]);

  useEffect(() => {
    return subscribeToQualifiedPageSection((section) => {
      setQualifiedSection(section);
      const locked = isSectionQueueLocked(stateRef.current.suggestionQueue);
      const lockedToThis =
        locked &&
        stateRef.current.suggestionQueue.lockedSectionKey === section.sectionId;
      if (!locked || lockedToThis) {
        // New section may fetch; don't wipe an in-flight locked other section.
        if (!locked) {
          hideBubble();
          clearTimers();
        }
      } else {
        // Defer fetch for this section until the lock clears.
        const decision = requestSectionFetch(
          stateRef.current.suggestionQueue,
          section.sectionId,
        );
        stateRef.current = {
          ...stateRef.current,
          suggestionQueue: decision.queue,
        };
        persist();
      }
    });
  }, [clearTimers, hideBubble, persist]);

  /** Fetch / drain on qualified section dwell (after session batch, respects lock). */
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
    if (sessionBatchPending()) return;
    if (
      isPageVisitComplete(
        stateRef.current,
        pathname,
        knownSectionKeysRef.current,
      )
    ) {
      return;
    }
    if (
      isSectionFullyShown(
        stateRef.current,
        pathname,
        qualifiedSection.sectionId,
      )
    ) {
      return;
    }
    void showNextRef.current("dwell");
  }, [
    isOpen,
    lifecycleVersion,
    pathname,
    proactiveEnabled,
    qualifiedSection,
    sessionBatchPending,
    tabVisible,
  ]);

  useEffect(() => {
    const onScroll = () => {
      // Hide the bubble on scroll for cleanliness, but keep the queue intact
      // so locked section remaining prompts continue after rotateGap.
      if (active) hideBubble();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
      if (queueHasItems() || sessionBatchPending()) {
        scheduleNext(proactive.rotateGapMs);
      } else {
        scheduleNext(proactive.initialIdleMs);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [
    active,
    hideBubble,
    proactive.initialIdleMs,
    proactive.rotateGapMs,
    queueHasItems,
    scheduleNext,
    sessionBatchPending,
  ]);

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
      if (queueHasItems() || sessionBatchPending()) {
        scheduleNext(proactive.rotateGapMs);
      } else {
        scheduleNext(proactive.initialIdleMs);
      }
    };

    document.addEventListener("pointerdown", pauseForInteraction, true);
    document.addEventListener("keydown", pauseForInteraction, true);
    document.addEventListener("focusout", resumeAfterInteraction, true);
    return () => {
      document.removeEventListener("pointerdown", pauseForInteraction, true);
      document.removeEventListener("keydown", pauseForInteraction, true);
      document.removeEventListener("focusout", resumeAfterInteraction, true);
    };
  }, [
    clearTimers,
    hideBubble,
    proactive.initialIdleMs,
    proactive.rotateGapMs,
    queueHasItems,
    scheduleNext,
    sessionBatchPending,
  ]);

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
      postChatPendingRef.current =
        userMessageCountRef.current > openUserMessageCountRef.current;
      clearTimers();
      if (!postChatPendingRef.current) {
        if (queueHasItems()) scheduleNext(proactive.rotateGapMs);
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
        metadata: active.sectionKey
          ? { sectionKey: active.sectionKey }
          : undefined,
      });
    }
    hideBubble();
    if (queueHasItems()) scheduleNext(proactive.rotateGapMs);
  }, [
    active,
    hideBubble,
    pathname,
    proactive.rotateGapMs,
    queueHasItems,
    scheduleNext,
  ]);

  const clickActive = useCallback(() => {
    if (active) {
      trackProactiveTrigger({
        eventType: "clicked",
        triggerType: activeTriggerRef.current,
        pagePath: pathname,
        suggestionId: active.id,
        metadata: active.sectionKey
          ? { sectionKey: active.sectionKey }
          : undefined,
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
