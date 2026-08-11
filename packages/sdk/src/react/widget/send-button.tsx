"use client";

import { MouseEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button, PromptInputAction } from "../../ui";
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

  return (
    <PromptInputAction
      className="cursor-pointer"
      tooltip={assistantTyping ? "Stop Generation" : "Send message"}
    >
      <Button
        variant="default"
        size="icon"
        className="h-8 w-8 rounded-full cursor-pointer"
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
          <Square className="size-4 cursor-pointer" />
        ) : (
          <ArrowUp className="size-4 cursor-pointer" />
        )}
      </Button>
    </PromptInputAction>
  );
}
