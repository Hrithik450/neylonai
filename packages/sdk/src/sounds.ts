/**
 * Widget audio — browser-safe pop for proactive suggestions.
 *
 * unlock() after a user gesture, then playPop(id). Never throws; UI stays independent.
 */

import { apiUrl } from "./network";

type WindowWithWebkit = Window & {
  webkitAudioContext?: typeof AudioContext;
};

/** Path for the uploaded asset served by the Neylon AI backend. */
export const SUGGESTION_POP_SOUND_PATH = "/sounds/pop.mp3";

export interface WidgetAudioManagerOptions {
  /** Absolute URL. Default: Neylon AI backend `/sounds/pop.mp3`. */
  src?: string;
  /** 0–1 linear gain. Default 0.22. */
  volume?: number;
  /** localStorage key for mute preference. */
  enabledStorageKey?: string;
}

const DEFAULT_ENABLED_KEY = "neylonai.widgetSound.enabled";
const MAX_PLAYED_IDS = 64;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const readEnabledFlag = (key: string) => {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(key);
    return raw === null || (raw !== "0" && raw !== "false");
  } catch { return true; }
};

const writeEnabledFlag = (key: string, enabled: boolean) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, enabled ? "1" : "0"); } catch {}
};

export class WidgetAudioManager {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loadPromise: Promise<AudioBuffer | null> | null = null;
  private unlocked = false;
  private enabled: boolean;
  private readonly playedIds = new Set<string>();
  private lastPlayAt = 0;
  private readonly src: string;
  private volume: number;
  private readonly enabledStorageKey: string;
  private pendingSuggestionId: string | null = null;

  constructor(options: WidgetAudioManagerOptions = {}) {
    this.src = options.src ?? apiUrl(SUGGESTION_POP_SOUND_PATH);
    this.volume = Math.min(1, Math.max(0, options.volume ?? 0.22));
    this.enabledStorageKey = options.enabledStorageKey ?? DEFAULT_ENABLED_KEY;
    this.enabled = readEnabledFlag(this.enabledStorageKey);
  }

  isEnabled(): boolean {
    if (prefersReducedMotion()) return false;
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    writeEnabledFlag(this.enabledStorageKey, enabled);
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  isUnlocked(): boolean {
    return this.unlocked && this.ctx?.state === "running";
  }

  /** Resume AudioContext after a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.isEnabled()) return;

    try {
      const ctx = this.getOrCreateContext();
      if (!ctx) return;

      const finish = () => {
        this.unlocked = ctx.state === "running";
        if (!this.unlocked) return;
        void this.ensureBuffer();
        if (this.pendingSuggestionId) {
          const id = this.pendingSuggestionId;
          this.pendingSuggestionId = null;
          this.playPop(id);
        }
      };

      if (ctx.state === "running") {
        finish();
        return;
      }

      void ctx.resume().then(finish).catch(() => {
        // Autoplay rejection — stay locked silently.
      });
    } catch {
      // ignore
    }
  }

  /**
   * Play the pop for a suggestion.
   * Dedupes by id (Strict Mode / rerender safe). Silent until unlock().
   */
  playPop(suggestionId?: string): void {
    if (typeof window === "undefined") return;
    if (!this.isEnabled()) return;
    if (suggestionId && this.playedIds.has(suggestionId)) return;

    if (!this.unlocked && this.ctx?.state !== "running") {
      if (suggestionId) this.pendingSuggestionId = suggestionId;
      return;
    }

    if (suggestionId) {
      this.playedIds.add(suggestionId);
      if (this.playedIds.size > MAX_PLAYED_IDS) {
        const first = this.playedIds.values().next().value;
        if (first !== undefined) this.playedIds.delete(first);
      }
    }

    const now = Date.now();
    if (now - this.lastPlayAt < 120) return;
    this.lastPlayAt = now;

    void this.playBufferSafely();
  }

  private getOrCreateContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx =
      window.AudioContext ||
      (window as WindowWithWebkit).webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    return this.ctx;
  }

  private async ensureBuffer(): Promise<AudioBuffer | null> {
    if (this.buffer) return this.buffer;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const ctx = this.getOrCreateContext();
      if (!ctx) return null;
      try {
        const res = await fetch(this.src);
        if (!res.ok) return null;
        const bytes = await res.arrayBuffer();
        this.buffer = await ctx.decodeAudioData(bytes.slice(0));
        return this.buffer;
      } catch {
        return null;
      }
    })();

    return this.loadPromise;
  }

  private async playBufferSafely(): Promise<void> {
    try {
      const ctx = this.getOrCreateContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          return;
        }
      }
      if (ctx.state !== "running") return;

      this.unlocked = true;
      const buffer = await this.ensureBuffer();
      if (!buffer) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = this.volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {
      // Never surface audio failures to callers.
    }
  }
}

export const widgetAudioManager = new WidgetAudioManager();
