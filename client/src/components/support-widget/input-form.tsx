"use client";

import React from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useAssistantStore, useInputStore } from "@/store/store";
import { PromptInput, PromptInputActions } from "@/components/ui/prompt-input";
import { AudioVisualizer } from "@/components/support-widget/audio-visualizer";
import { ChatInputTextarea } from "@/components/support-widget/input-text-area";
import { MicButton } from "@/components/support-widget/mic-button";
import { SendButton } from "@/components/support-widget/send-button";

export function InputForm({
  handleSendMessage,
}: {
  handleSendMessage: () => void;
}) {
  const { input, setInput, disableInput } = useInputStore();
  const { isAssistantTyping } = useAssistantStore();
  const {
    audioChunksRef,
    isRecording,
    classicLoading,
    streamRef,
    toggleRecording,
    setIsRecording,
    setClassicLoading,
  } = useAudioRecorder(speechToText);

  async function speechToText() {
    const audioBlob = new Blob(audioChunksRef.current, {
      type: "audio/webm",
    });
    const formData = new FormData();
    formData.append("audio", audioBlob);

    try {
      const response = await fetch("/api/model/speech-to-text", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.text) {
        setInput(data.text);
      }
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setClassicLoading(false);
      setIsRecording(false);
    }
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 px-2 md:px-4">
      <PromptInput
        value={input}
        onValueChange={(value) => setInput(value)}
        className="flex justify-center items-center rounded-2xl border border-black/60 my-0"
      >
        {isRecording ? (
          <AudioVisualizer stream={streamRef.current} className="h-10" />
        ) : (
          <ChatInputTextarea
            placeholder="Ask me anything..."
            handleSubmit={handleSendMessage}
            disabled={isAssistantTyping}
          />
        )}

        <PromptInputActions className="self-end">
          <MicButton
            isRecording={isRecording}
            classicLoading={classicLoading}
            toggleRecording={toggleRecording}
          />

          <SendButton
            isDisabled={!input.trim() || disableInput}
            handleSubmit={handleSendMessage}
          />
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}
