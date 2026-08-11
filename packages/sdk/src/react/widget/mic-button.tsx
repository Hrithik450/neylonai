"use client";

import { Loader2, Mic, CircleStop } from "lucide-react";
import { Button, PromptInputAction } from "../../ui";

interface MicButtonProps {
  isRecording: boolean;
  isTranscribing: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function MicButton({
  isRecording,
  isTranscribing,
  disabled,
  onToggle,
}: MicButtonProps) {
  const busy = isTranscribing;
  const tooltip = busy
    ? "Transcribing…"
    : isRecording
      ? "Stop recording"
      : "Voice input";

  return (
    <PromptInputAction className="cursor-pointer" tooltip={tooltip}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || busy}
        aria-label={tooltip}
        aria-pressed={isRecording}
        className={`h-8 w-8 rounded-full cursor-pointer border-black/20 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 ${
          isRecording
            ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100 animate-pulse"
            : ""
        }`}
        onClick={(e) => {
          e.preventDefault();
          if (busy) return;
          onToggle();
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isRecording ? (
          <CircleStop className="size-4" />
        ) : (
          <Mic className="size-4" />
        )}
      </Button>
    </PromptInputAction>
  );
}
