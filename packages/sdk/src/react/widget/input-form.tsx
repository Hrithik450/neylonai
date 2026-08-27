"use client";

import { useCallback, useRef, useState } from "react";
import { ChatInputTextarea } from "./input-text-area";
import { PromptInput, PromptInputActions } from "../../ui";
import { SuggestionBar } from "./suggestion-bar";
import { SendButton } from "./send-button";
import { MicButton } from "./mic-button";
import { AudioVisualizer } from "./audio-visualizer";

import { useWidgetHost } from "../context/widget-host";
import { useWidgetStore } from "../store/widget-store";
import { useInputStore } from "../store/input-store";
import {
  useAudioRecorder,
  type AudioRecording,
} from "../hooks/use-audio-recorder";
import { transcribeAudio } from "../../transcribe";

interface InputFormProps {
  sendMessage: () => void;
  stopStreaming: () => void;
}

function appendTranscript(existing: string, transcript: string): string {
  const next = transcript.trim();
  if (!next) return existing;
  const base = existing.trimEnd();
  if (!base) return next.slice(0, 1500);
  return `${base} ${next}`.slice(0, 1500);
}

export function InputForm({ sendMessage, stopStreaming }: InputFormProps) {
  const { assistantTyping } = useWidgetStore();
  const { onError, config } = useWidgetHost();
  const { input, setInput, disableInput } = useInputStore();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcribeAbortRef = useRef<AbortController | null>(null);

  const voiceEnabled = config.features.voiceInput !== false;

  const handleRecordingComplete = useCallback(
    async (recording: AudioRecording) => {
      if (recording.durationMs < 400) {
        onError("Hold the mic a bit longer so we can hear you.");
        return;
      }

      transcribeAbortRef.current?.abort();
      const abort = new AbortController();
      transcribeAbortRef.current = abort;

      setIsTranscribing(true);
      try {
        const result = await transcribeAudio({
          audio: recording.blob,
          durationMs: recording.durationMs,
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        if (!result.text) {
          onError("No speech detected. Please try again.");
          return;
        }
        const current = useInputStore.getState().input;
        setInput(appendTranscript(current, result.text));
      } catch (error) {
        if (abort.signal.aborted) return;
        onError(
          error instanceof Error
            ? error.message
            : "Could not transcribe audio. Please try again.",
        );
      } finally {
        if (transcribeAbortRef.current === abort) {
          transcribeAbortRef.current = null;
        }
        setIsTranscribing(false);
      }
    },
    [onError, setInput],
  );

  const recorder = useAudioRecorder({
    onError,
    onRecordingComplete: (recording) => {
      void handleRecordingComplete(recording);
    },
  });

  const handleSubmit = () => {
    if (input.length >= 1500) {
      onError(
        "Your message is too long. Please shorten it to 1500 characters or fewer.",
      );
      return;
    }

    sendMessage();
  };

  const handleMicToggle = () => {
    if (assistantTyping || disableInput || isTranscribing) return;
    if (recorder.isRecording) {
      recorder.stop();
      return;
    }
    void recorder.start();
  };

  const showVisualizer =
    voiceEnabled && recorder.isRecording && Boolean(recorder.stream);

  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 flex min-w-0 w-full max-w-full flex-col gap-1 px-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1 md:px-3 md:pb-1.5">
      <SuggestionBar />

      <PromptInput
        value={input}
        onValueChange={(value) => setInput(value)}
        className="flex w-full min-w-0 max-w-full items-end rounded-2xl border px-2 py-1"
        style={{
          backgroundColor: config.branding.surfaceColor,
          borderColor: config.branding.borderColor,
          color: config.branding.primaryTextColor,
        }}
      >
        <div className="flex w-full min-w-0 flex-1 items-end gap-2">
          {showVisualizer ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5 self-center px-1">
              <AudioVisualizer
                stream={recorder.stream}
                color={config.branding.accentColor}
                className="flex-1"
              />
              <span
                className="shrink-0 text-[11px] font-medium tracking-wide"
                style={{ color: config.branding.secondaryTextColor }}
              >
                Listening…
              </span>
            </div>
          ) : (
            <ChatInputTextarea
              placeholder={config.messages.inputPlaceholder}
              handleSubmit={handleSubmit}
              disabled={assistantTyping || isTranscribing}
            />
          )}

          <PromptInputActions className="shrink-0 self-end gap-2 pb-0.5">
            {voiceEnabled ? (
              <MicButton
                isRecording={recorder.isRecording}
                isTranscribing={isTranscribing}
                disabled={assistantTyping || disableInput}
                onToggle={handleMicToggle}
              />
            ) : null}
            <SendButton
              isDisabled={!input.trim() || disableInput || isTranscribing}
              handleSubmit={handleSubmit}
              stopStreaming={stopStreaming}
            />
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  );
}
