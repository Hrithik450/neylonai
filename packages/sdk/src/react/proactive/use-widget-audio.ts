"use client";

import { useEffect, useRef } from "react";
import { widgetAudioManager } from "../..";
import { useWidgetHost } from "../context/widget-host";
import { PROACTIVE_CONFIG } from "./config";

/**
 * Unlocks audio after the user's first interaction anywhere on the page,
 * then plays a pop when a proactive bubble is visible.
 */
export function useWidgetAudio(activeId: string | null, visible: boolean) {
  const { config } = useWidgetHost();
  const soundEnabled =
    PROACTIVE_CONFIG.soundEnabled && config.proactive.soundEnabled;
  const volume = config.proactive.volume;

  const visibleRef = useRef(visible);
  const activeIdRef = useRef(activeId);
  visibleRef.current = visible;
  activeIdRef.current = activeId;

  useEffect(() => {
    widgetAudioManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!soundEnabled) {
      widgetAudioManager.setEnabled(false);
      return;
    }
    widgetAudioManager.setEnabled(true);

    const unlock = () => {
      widgetAudioManager.unlock();
      const id = activeIdRef.current;
      if (visibleRef.current && id) {
        widgetAudioManager.playPop(id);
      }
    };

    const opts: AddEventListenerOptions = { capture: true, once: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);

    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
    };
  }, [soundEnabled]);

  useEffect(() => {
    if (!visible || !activeId || !soundEnabled) return;
    widgetAudioManager.playPop(activeId);
  }, [visible, activeId, soundEnabled]);
}
