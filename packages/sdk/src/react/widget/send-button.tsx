"use client";

import { MouseEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button, PromptInputAction } from "../../ui";
import { useWidgetHost } from "../context/widget-host";
import { useWidgetStore } from "../store/widget-store";

interface SendButtonProps {
  isDisabled: boolean;
  handleSubmit: (e?: MouseEvent<HTMLButtonElement>) => void;
  stopStreaming: () => void;
}

export function SendButton({
  isDisabled,
  handleSubmit,
  stopStreaming,
}: SendButtonProps) {
  const { assistantTyping } = useWidgetStore();
  const { config } = useWidgetHost();
  const { primaryTextBackground, askButtonTextColor } = config.branding;

  return (
    <PromptInputAction
      className="cursor-pointer"
      tooltip={assistantTyping ? "Stop Generation" : "Send message"}
    >
      <Button
        variant="default"
        size="icon"
        className="h-8 w-8 rounded-full cursor-pointer border"
        style={{
          backgroundColor: primaryTextBackground,
          color: askButtonTextColor,
          borderColor: askButtonTextColor,
        }}
        onClick={(e) => {
          if (assistantTyping) {
            e.preventDefault();
            stopStreaming();
            return;
          }
          handleSubmit(e);
        }}
        disabled={assistantTyping ? false : isDisabled}
      >
        {assistantTyping ? (
          <Square className="size-4 cursor-pointer" style={{ fill: "currentColor" }} />
        ) : (
          <ArrowUp className="size-4 cursor-pointer" />
        )}
      </Button>
    </PromptInputAction>
  );
}
