"use client";

import React from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useAssistantStore, useInputStore } from "@/store/store";
import { PromptInput, PromptInputActions } from "@/components/ui/prompt-input";
import { AudioVisualizer } from "@/components/support-widget/audio-visualizer";
import { ChatInputTextarea } from "@/components/support-widget/input-text-area";
import { MicButton } from "@/components/support-widget/mic-button";
import { SendButton } from "@/components/support-widget/send-button";
import { SuggestionBar } from "./suggestion-bar";
import { Button } from "../ui/button";
import { FileText, Paperclip, X } from "lucide-react";

export function InputForm({
  handleSendMessage,
}: {
  handleSendMessage: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { input, setInput, disableInput, setFile, file } = useInputStore();
  const { assistantTyping } = useAssistantStore();
  const {
    audioChunksRef,
    isRecording,
    streamRef,
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
        className="flex flex-col justify-center items-center w-full rounded-b-2xl border border-black/60 my-0 px-2"
      >
        <SuggestionBar />

        {file && (
          <div className="flex items-center justify-start mr-auto max-w-max mt-2 px-2 py-1 bg-muted/40 border border-black/20 rounded-md shadow-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {file.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-500 hover:text-red-500 rounded-full cursor-pointer"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 flex justify-center items-center w-full">
          {isRecording ? (
            <AudioVisualizer stream={streamRef.current} className="h-10" />
          ) : (
            <ChatInputTextarea
              placeholder="Ask me anything..."
              handleSubmit={handleSendMessage}
              disabled={assistantTyping}
            />
          )}

          <PromptInputActions className="self-end gap-3">
            {/* <MicButton
            isRecording={isRecording}
            classicLoading={classicLoading}
            toggleRecording={toggleRecording}
          /> */}

            <label title="Upload PDF" htmlFor="file-upload">
              <input
                type="file"
                accept=".pdf"
                id="file-upload"
                className="hidden"
                ref={fileInputRef}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const uploaded = e.target.files?.[0];
                  if (uploaded) setFile(uploaded);
                }}
              />
              <Button
                asChild
                type="button"
                size="icon-sm"
                variant="ghost"
                title="Upload PDF"
                className="rounded-full cursor-pointer hover:bg-muted transition"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            </label>

            <SendButton
              isDisabled={!input.trim() || disableInput}
              handleSubmit={handleSendMessage}
            />
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  );
}
