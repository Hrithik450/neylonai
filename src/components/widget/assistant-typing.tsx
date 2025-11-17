"use client";

import React from "react";
import { Brain } from "lucide-react";
import { useWidgetStore } from "@/store/widget-store";
import { thinkingPhases } from "@/lib/constants";

export function DynamicAssistantTyping({ speed = 2000 }: { speed?: number }) {
  const { thinkingPhase, assistantTyping } = useWidgetStore();

  const [thoughts, setThoughts] = React.useState<string[]>(
    thinkingPhases.default,
  );
  const [msgIndex, setMsgIndex] = React.useState<number>(0);

  React.useEffect(() => {
    const newThoughts =
      thinkingPhases[thinkingPhase as keyof typeof thinkingPhases] ||
      thinkingPhases.default;

    setMsgIndex(0);
    setThoughts(newThoughts);
  }, [thinkingPhase]);

  React.useEffect(() => {
    if (!assistantTyping) return;

    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % thoughts.length);
    }, speed);

    return () => clearInterval(timer);
  }, [assistantTyping, thoughts]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 md:mb-4 py-3 px-4 rounded-lg mr-auto w-full"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-10 h-10">
          <div className="absolute rounded-full ">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            </div>
          </div>

          <div className="relative z-10 p-2 bg-white rounded-full flex items-center justify-center">
            <Brain className="w-5 h-5 text-gray-700" />
          </div>
        </div>

        <div className="flex-1">
          <span className="text-sm md:text-base text-gray-800 font-medium">
            {thoughts[msgIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}
