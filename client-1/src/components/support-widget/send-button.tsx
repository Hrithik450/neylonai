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
  const { assistantTyping } = useAssistantStore();

  return (
    <PromptInputAction
      className="cursor-pointer"
      tooltip={assistantTyping ? "Stop Generation" : "Send message"}
    >
      <Button
        variant="default"
        size="icon"
        className="h-8 w-8 rounded-full cursor-pointer"
        onClick={handleSubmit}
        disabled={isDisabled}
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
