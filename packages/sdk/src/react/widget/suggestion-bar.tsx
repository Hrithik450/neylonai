"use client";

import React from "react";
import { Button } from "../../ui";
import { useInputStore } from "../store/input-store";
import { useWidgetHost } from "../context/widget-host";

export function SuggestionBar() {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const { input, setInput } = useInputStore();
  const { config } = useWidgetHost();
  const suggestions = config.messages.suggestedQuestions;
  const surface = config.branding.secondaryTextBackground;
  const secondary = config.branding.secondaryTextColor;

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const filterSuggestions = React.useMemo(() => {
    if (!input.trim()) return suggestions;
    const query = input.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          a.toLowerCase().indexOf(query) - b.toLowerCase().indexOf(query),
      );
  }, [input, suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <div className="w-full min-w-0 max-w-full">
      <div
        ref={scrollRef}
        className="w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max max-w-none gap-1.5 py-0.5">
          {filterSuggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 rounded-full border px-2.5 py-0 text-xs font-medium shadow-none hover:opacity-90"
              style={{
                backgroundColor: surface,
                color: secondary,
                borderColor: config.branding.borderColor,
              }}
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </Button>
          ))}

          {filterSuggestions.length === 0 && (
            <span className="px-1 text-xs italic" style={{ color: secondary }}>
              No suggestions found...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
