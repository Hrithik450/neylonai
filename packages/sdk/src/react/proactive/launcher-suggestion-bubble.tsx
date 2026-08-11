"use client";

import { cn } from "../../ui";

export interface SuggestionBubbleData {
  id: string;
  text: string;
}

interface LauncherSuggestionBubbleProps {
  suggestion: SuggestionBubbleData;
  visible: boolean;
  align?: "left" | "right";
  onSelect?: (text: string) => void;
}

/**
 * Contextual teaser above Ask AI.
 * Clickable when onSelect is provided — opens chat and sends the suggestion.
 */
export function LauncherSuggestionBubble({
  suggestion,
  visible,
  align = "right",
  onSelect,
}: LauncherSuggestionBubbleProps) {
  const isLeft = align === "left";
  const interactive = Boolean(onSelect);

  return (
    <div
      className={cn(
        "absolute bottom-full mb-3 w-max max-w-[min(18.5rem,calc(100vw-2rem))]",
        isLeft ? "left-0" : "right-0",
        "transition-all duration-200 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
        !visible && "pointer-events-none",
        !interactive && "pointer-events-none",
      )}
      aria-live="polite"
      aria-hidden={!visible}
    >
      {interactive ? (
        <button
          type="button"
          data-proactive-suggestion
          data-testid="suggestion-bubble"
          onClick={() => onSelect?.(suggestion.text)}
          className={cn(
            "relative block w-full text-left rounded-2xl border border-[#0E3228]/12",
            "bg-white/95 backdrop-blur-sm shadow-lg px-3.5 py-3",
            "cursor-pointer hover:border-[#0E3228]/25 hover:shadow-xl transition-shadow",
          )}
        >
          <p className="text-sm leading-snug text-[#0E3228]/90 whitespace-normal break-words line-clamp-2">
            {suggestion.text}
          </p>
          <span className="mt-1.5 block text-[11px] font-medium text-[#0E3228]/45">
            Tap to ask
          </span>
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white border-r border-b border-[#0E3228]/12",
              isLeft ? "left-7" : "right-7",
            )}
          />
        </button>
      ) : (
        <div
          data-proactive-suggestion
          data-testid="suggestion-bubble"
          className={cn(
            "relative rounded-2xl border border-[#0E3228]/12",
            "bg-white/95 backdrop-blur-sm shadow-lg px-3.5 py-3",
          )}
        >
          <p className="text-sm leading-snug text-[#0E3228]/90 whitespace-normal break-words line-clamp-2">
            {suggestion.text}
          </p>
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white border-r border-b border-[#0E3228]/12",
              isLeft ? "left-7" : "right-7",
            )}
          />
        </div>
      )}
    </div>
  );
}
