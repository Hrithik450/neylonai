"use client";

import { Loader2, Mic, CircleStop } from "lucide-react";
import { Button, PromptInputAction } from "../../ui";
import { useWidgetHost } from "../context/widget-host";

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
  const { config } = useWidgetHost();
  const { surfaceColor, borderColor, primaryTextColor } = config.branding;
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
        className={`h-8 w-8 rounded-full cursor-pointer border ${
          isRecording
            ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100 animate-pulse"
            : "hover:opacity-90"
        }`}
        style={
          isRecording
            ? undefined
            : {
                backgroundColor: surfaceColor,
                borderColor,
                color: primaryTextColor,
              }
        }
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
