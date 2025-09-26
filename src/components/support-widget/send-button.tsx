"use client";

import { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { PromptInputAction } from "@/components/ui/prompt-input";
import { useAssistantStore } from "@/store//store";

interface SendButtonProps {
  isDisabled: boolean;
  handleSubmit: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function SendButton({ isDisabled, handleSubmit }: SendButtonProps) {
  const { isAssistantTyping } = useAssistantStore();

  return (
    <PromptInputAction
      className="cursor-pointer"
      tooltip={isAssistantTyping ? "Stop Generation" : "Send message"}
    >
      <Button
        variant="default"
        size="icon"
        className="h-10 w-10 rounded-full cursor-pointer"
        onClick={handleSubmit}
        disabled={isDisabled}
      >
        {isAssistantTyping ? (
          <Square className="size-5 cursor-pointer" />
        ) : (
          <ArrowUp className="size-5 cursor-pointer" />
        )}
      </Button>
    </PromptInputAction>
  );
}
