/** Timing for proactive launcher suggestions. */
export const PROACTIVE_CONFIG = {
  storageKey: "neylonai.proactiveSuggestions.v10",
  /** Quiet delay before the first bubble. */
  initialIdleMs: 2_200,
  /** How long a bubble stays visible. */
  displayMs: 6_500,
  /** Gap after auto-hide before the next bubble. */
  rotateGapMs: 4_500,
  /** Bubbles delivered per tab session, excluding the one-time welcome. */
  sessionSuggestionLimit: 4,
  /** After widget closes, wait before post-chat suggestions. */
  postChatDelayMs: 2_000,
  /** Personalized suggestions requested per pool refresh (3–5). */
  poolLimit: 5,
  /** Refresh pool after this age so content stays fresh while looping. */
  poolTtlMs: 2 * 60 * 1000,
  /**
   * Master switch for suggestion pops.
   * Users can also mute via widgetAudioManager.setEnabled(false).
   */
  soundEnabled: true,
} as const;
