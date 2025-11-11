"use client";

import { Mic } from "lucide-react";
import { CircleStop } from "lucide-react";
import { ClassicLoader } from "@/components/classic-loader";

import { Button } from "@/components/ui/button";
import { PromptInputAction } from "@/components/ui/prompt-input";

import { useErrorStore } from "@/store/error-store";

interface MicButtonProps {
  isRecording: boolean;
  classicLoading: boolean;
  toggleRecording: () => void;
}

export function MicButton({
  isRecording,
  classicLoading,
  toggleRecording,
}: MicButtonProps) {
  const { setMessage, setStatus } = useErrorStore();

  return (
    <PromptInputAction tooltip={isRecording ? "Stop Recording" : "Record"}>
      <Button
        variant="default"
        size="icon"
        className={`h-8 w-8 rounded-full cursor-pointer bg-white text-gray-600 hover:bg-gray-200 ${
          isRecording ? "text-red-400 animate-pulse" : "text-gray-500"
        }`}
        onClick={() => {
          toggleRecording();
        }}
      >
        {isRecording ? (
          classicLoading ? (
            <ClassicLoader />
          ) : (
            <CircleStop className="size-6" />
          )
        ) : (
          <Mic className="size-6" />
        )}
      </Button>
    </PromptInputAction>
  );
}
