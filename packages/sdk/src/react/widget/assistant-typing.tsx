"use client";

import React from "react";
import { Brain, Lightbulb } from "lucide-react";
import { useWidgetStore } from "../store/widget-store";
import { useWidgetHost } from "../context/widget-host";
import { DEFAULT_THINKING_MESSAGES } from "../constants";

export function DynamicAssistantTyping({ speed = 5200 }: { speed?: number }) {
  const { thinkingTips, assistantTyping } = useWidgetStore();
  const { config } = useWidgetHost();
  const { primaryTextColor, secondaryTextColor, surfaceColor, borderColor } =
    config.branding;

  const [thoughts, setThoughts] = React.useState<string[]>([
    ...DEFAULT_THINKING_MESSAGES,
  ]);
  const [msgIndex, setMsgIndex] = React.useState(0);

  React.useEffect(() => {
    const next =
      thinkingTips.length > 0 ? thinkingTips : [...DEFAULT_THINKING_MESSAGES];
    setMsgIndex(0);
    setThoughts(next);
  }, [thinkingTips]);

  React.useEffect(() => {
    if (!assistantTyping || thoughts.length === 0) return;

    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % thoughts.length);
    }, speed);

    return () => clearInterval(timer);
  }, [assistantTyping, thoughts, speed]);

  const current = thoughts[msgIndex] ?? DEFAULT_THINKING_MESSAGES[0];
  const isTip = thinkingTips.length > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 md:mb-4 py-2 px-3 md:px-2 rounded-lg mr-auto w-full"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
          <div className="absolute rounded-full">
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 border-2 rounded-full animate-spin"
                style={{ borderColor, borderTopColor: primaryTextColor }}
              />
            </div>
          </div>

          <div
            className="relative z-10 p-2 rounded-full flex items-center justify-center"
            style={{ backgroundColor: surfaceColor }}
          >
            {isTip ? (
              <Lightbulb className="w-5 h-5 text-amber-600" />
            ) : (
              <Brain className="w-5 h-5" style={{ color: primaryTextColor }} />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {isTip && (
            <p
              className="text-[11px] uppercase tracking-wide mb-0.5"
              style={{ color: secondaryTextColor }}
            >
              While you wait
            </p>
          )}
          <span
            className="block text-sm md:text-base font-medium truncate"
            style={{ color: primaryTextColor }}
          >
            {current}
          </span>
        </div>
      </div>
    </div>
  );
}
