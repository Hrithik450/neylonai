/** Timing for proactive launcher suggestions. */
export const PROACTIVE_CONFIG = {
  storageKey: "neylonai.proactive.suggestions.v1",
  /** Quiet delay before the very first bubble of a session. */
  initialIdleMs: 1_000,
  /** How long a bubble stays visible. */
  displayMs: 8_000,
  /** Quiet gap after a bubble closes before the next one may appear. */
  rotateGapMs: 10_000,
  /** Random extra gap on top of `rotateGapMs` so pacing never feels mechanical. */
  rotateGapJitterMs: 2_000,
  /**
   * Enforced minimums. Dashboard/stored overrides may only make bubbles
   * *rarer* than this — never more frequent — so a stale published config
   * can't bring bubble spam back.
   */
  minDisplayMs: 8_000,
  minRotateGapMs: 10_000,
  /**
   * Bubbles delivered per tab session, welcome included. Reloading the tab
   * re-enters the same session, so the budget is not refunded. On-demand
   * bubbles earned by chatting are exempt (see `countsTowardSessionLimit`).
   */
  sessionSuggestionLimit: 10,
  /** After the widget closes on a real chat, wait before the on-demand bubble. */
  postChatDelayMs: 2_000,
  /** Personalized suggestions requested per pool refresh (3–5). */
  poolLimit: 5,
  /**
   * Master switch for suggestion pops.
   * Users can also mute via widgetAudioManager.setEnabled(false).
   */
  soundEnabled: true,
} as const;
