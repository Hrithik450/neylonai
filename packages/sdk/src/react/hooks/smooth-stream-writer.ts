/**
 * Smooth stream display tuned for Claude-like eye sync.
 *
 * Network tokens often arrive in bursts (esp. Gemini). We buffer them and
 * reveal at a steady characters-per-second rate so reading feels calm.
 * On stream end we *drain* at the same pace — never dump the remainder.
 */

export interface SmoothStreamWriter {
  push: (chunk: string) => void;
  /** Instant jump to full text (Stop / abort only). */
  flush: () => void;
  /**
   * Drop all buffered and revealed text without painting.
   * The caller owns clearing the bubble so a queued paint can't resurrect it.
   */
  reset: () => void;
  /** Keep revealing at the same pace until display catches up to received. */
  drain: () => Promise<void>;
  dispose: () => void;
  getReceived: () => string;
  getDisplayed: () => string;
}

export interface CreateSmoothStreamWriterOptions {
  onFlush: (displayed: string) => void;
  /**
   * Steady reveal speed (characters per second).
   * @default 42
   */
  charsPerSecond?: number;
  /**
   * Hard cap per animation frame so bursts never dump a paragraph at once.
   * @default 2
   */
  maxCharsPerFrame?: number;
}

/** Backlog (in characters) that doubles the reveal speed. */
const CATCH_UP_LAG_CHARS = 160;
/** Ceiling on the catch-up multiplier so reveal never becomes a dump. */
const MAX_CATCH_UP = 4;

export function createSmoothStreamWriter(
  options: CreateSmoothStreamWriterOptions,
): SmoothStreamWriter {
  const charsPerSecond = Math.max(1, options.charsPerSecond ?? 42);
  const maxCharsPerFrame = Math.max(1, options.maxCharsPerFrame ?? 2);

  let received = "";
  let displayed = "";
  let rafId: number | null = null;
  let disposed = false;
  let lastTickMs = 0;
  let carry = 0;
  let drainResolve: (() => void) | null = null;

  const settleDrain = () => {
    if (drainResolve && displayed.length >= received.length) {
      const resolve = drainResolve;
      drainResolve = null;
      resolve();
    }
  };

  const schedule = () => {
    if (disposed || rafId != null) return;
    rafId = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    rafId = null;
    if (disposed) return;

    if (lastTickMs === 0) lastTickMs = now;
    const elapsedSec = Math.min(0.05, (now - lastTickMs) / 1000);
    lastTickMs = now;

    if (displayed.length < received.length) {
      const lag = received.length - displayed.length;
      // Gemini delivers in bursts; without catch-up a long answer would still
      // be typing out seconds after the model finished.
      const catchUp = Math.min(MAX_CATCH_UP, 1 + lag / CATCH_UP_LAG_CHARS);
      carry += elapsedSec * charsPerSecond * catchUp;
      let step = Math.floor(carry);
      carry -= step;

      if (step < 1) {
        step = 0;
      }
      step = Math.min(lag, step, maxCharsPerFrame);

      if (step > 0) {
        displayed = received.slice(0, displayed.length + step);
        options.onFlush(displayed);
      }
    }

    if (!disposed && displayed.length < received.length) {
      schedule();
    } else {
      lastTickMs = 0;
      carry = 0;
      settleDrain();
    }
  };

  return {
    push(chunk: string) {
      if (!chunk || disposed) return;
      received += chunk;
      schedule();
    },
    flush() {
      if (disposed) return;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      carry = 0;
      lastTickMs = 0;
      displayed = received;
      options.onFlush(displayed);
      settleDrain();
    },
    reset() {
      if (disposed) return;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      received = "";
      displayed = "";
      carry = 0;
      lastTickMs = 0;
      settleDrain();
    },
    drain() {
      if (disposed || displayed.length >= received.length) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const previous = drainResolve;
        drainResolve = () => {
          previous?.();
          resolve();
        };
        schedule();
      });
    },
    dispose() {
      disposed = true;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Unblock any waiter so the handler can finish cleanup.
      if (drainResolve) {
        const resolve = drainResolve;
        drainResolve = null;
        resolve();
      }
    },
    getReceived: () => received,
    getDisplayed: () => displayed,
  };
}
