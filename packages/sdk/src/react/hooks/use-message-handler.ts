"use client";

import { useCallback, useEffect, useRef } from "react";
import { startTransition } from "react";
import { useInputStore } from "../store/input-store";
import { useWidgetStore } from "../store/widget-store";
import { useWidgetHost } from "../context/widget-host";
import { useThreadMessageStore, useThreadStore } from "../store/thread-store";
import { flushStreamToken } from "./stream-token-buffer";
import { createSmoothStreamWriter } from "./smooth-stream-writer";
import { isAbortError, streamChat, getChatParticipantId } from "../..";

/**
 * Owns widget chat send/stream/stop.
 * Tokens are revealed with rAF batching for ChatGPT/Claude-like smoothness.
 */
export function useWidgetMessageHandler() {
  const { user, onError } = useWidgetHost();
  const { updateMessage } = useThreadMessageStore();
  const { setInput, setDisableInput } = useInputStore();
  const { setCurrentThreadId, setThreads } = useThreadStore();

  const { setAssistantTyping, setIsStreaming, setThinkingTips } =
    useWidgetStore();

  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const writerRef = useRef<ReturnType<typeof createSmoothStreamWriter> | null>(
    null,
  );
  /** Survives abort/interrupt so follow-ups stay on the same thread. */
  const sessionThreadIdRef = useRef<string | null>(
    useThreadStore.getState().currentThreadId,
  );

  const resetUiAfterStream = useCallback(() => {
    inFlightRef.current = false;
    setDisableInput(false);
    setAssistantTyping(false);
    setIsStreaming(false);
    setThinkingTips([]);
  }, [setDisableInput, setAssistantTyping, setIsStreaming, setThinkingTips]);

  const bindThreadId = useCallback(
    (id: string | null) => {
      sessionThreadIdRef.current = id;
      setCurrentThreadId(id);
    },
    [setCurrentThreadId],
  );

  // Keep session ref aligned when messages screen binds an existing thread / new chat.
  useEffect(() => {
    return useThreadStore.subscribe((state, prev) => {
      if (state.currentThreadId === prev.currentThreadId) return;
      sessionThreadIdRef.current = state.currentThreadId;
    });
  }, []);

  const stopStreaming = useCallback(() => {
    if (!inFlightRef.current && !abortRef.current) return;

    streamIdRef.current += 1;
    writerRef.current?.flush();
    writerRef.current?.dispose();
    writerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    resetUiAfterStream();
  }, [resetUiAfterStream]);

  useEffect(() => {
    return () => {
      streamIdRef.current += 1;
      writerRef.current?.dispose();
      writerRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
      inFlightRef.current = false;
    };
  }, []);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? useInputStore.getState().input).trim();
      if (!text) return;

      // Preempt an in-flight turn (interrupt → follow-up stays one chat).
      if (inFlightRef.current || abortRef.current) {
        streamIdRef.current += 1;
        writerRef.current?.flush();
        writerRef.current?.dispose();
        writerRef.current = null;
        abortRef.current?.abort();
        abortRef.current = null;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const streamId = ++streamIdRef.current;
      inFlightRef.current = true;

      const isStale = () => streamId !== streamIdRef.current;

      const assistantId = crypto.randomUUID();
      let assistantCreated = false;
      let pendingFence = "";

      // Always read latest thread id (avoid stale hook closure after interrupt).
      const threadIdForRequest =
        sessionThreadIdRef.current ??
        useThreadStore.getState().currentThreadId;

      // Capture prior turns before appending this user message (for model context).
      const priorHistory = (useThreadMessageStore.getState().messages ?? [])
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0,
        )
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const paint = (displayed: string) => {
        if (isStale()) return;
        startTransition(() => {
          updateMessage((prev) => {
            const list = prev ?? [];
            if (!assistantCreated) {
              assistantCreated = true;
              return [
                ...list,
                {
                  role: "assistant",
                  id: assistantId,
                  thread: crypto.randomUUID(),
                  content: displayed,
                  created_at: new Date().toISOString(),
                },
              ];
            }
            const idx = list.findIndex((m) => m.id === assistantId);
            if (idx === -1) {
              return [
                ...list,
                {
                  role: "assistant",
                  id: assistantId,
                  thread: crypto.randomUUID(),
                  content: displayed,
                  created_at: new Date().toISOString(),
                },
              ];
            }
            const next = list.slice();
            next[idx] = { ...next[idx]!, content: displayed };
            return next;
          });
        });
      };

      const writer = createSmoothStreamWriter({
        onFlush: paint,
        charsPerSecond: 42,
        maxCharsPerFrame: 2,
      });
      writerRef.current = writer;

      updateMessage((prev) => [
        ...(prev ?? []),
        {
          role: "user",
          content: text,
          id: crypto.randomUUID(),
          thread: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        },
      ]);

      setInput("");
      setDisableInput(true);
      setAssistantTyping(true);
      setThinkingTips([]);

      const finishOwnedWriter = async (opts?: {
        reportError?: string;
        skipUiReset?: boolean;
      }) => {
        if (pendingFence) {
          writer.push(pendingFence);
          pendingFence = "";
        }
        try {
          await writer.drain();
        } catch {
          // Writer may already be disposed by stopStreaming.
        }
        if (writerRef.current === writer) {
          writer.dispose();
          writerRef.current = null;
        }
        if (!opts?.skipUiReset && !isStale()) {
          resetUiAfterStream();
        }
        if (opts?.reportError && !isStale()) {
          onError(opts.reportError);
        }
      };

      try {
        for await (const payload of streamChat({
          input: text,
          senderId: getChatParticipantId(user?.id),
          threadId: threadIdForRequest,
          conversationHistory: priorHistory,
          signal: controller.signal,
        })) {
          if (isStale()) return;

          switch (payload.event) {
            case "threadCreated": {
              const thread = payload.data;
              if (thread) setThreads(thread);
              if (thread.id) bindThreadId(thread.id);
              break;
            }

            case "thinkingTips": {
              const { tips, thinking } = payload.data;
              if (thinking === "true" || thinking === undefined) {
                setAssistantTyping(true);
              }
              if (Array.isArray(tips) && tips.length > 0) {
                setThinkingTips(tips);
              }
              break;
            }

            case "assistantResponse": {
              setAssistantTyping(false);
              setIsStreaming(true);
              const flushed = flushStreamToken(pendingFence, payload.data);
              pendingFence = flushed.pending;
              if (flushed.ready) writer.push(flushed.ready);
              break;
            }

            case "conversationEscalated":
              // Escalation reference is already in the assistant message.
              break;

            case "done":
              await finishOwnedWriter();
              break;

            case "error":
              await finishOwnedWriter({ reportError: payload.data.error });
              break;
          }
        }

        if (!isStale() && inFlightRef.current) {
          await finishOwnedWriter();
        }
      } catch (error) {
        if (isAbortError(error) || isStale()) return;
        console.error("streamChat error:", error);
        await finishOwnedWriter();
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (isStale() && writerRef.current === writer) {
          writer.dispose();
          writerRef.current = null;
        }
      }
    },
    [
      user?.id,
      updateMessage,
      setInput,
      setDisableInput,
      setAssistantTyping,
      setIsStreaming,
      setThinkingTips,
      setThreads,
      bindThreadId,
      onError,
      resetUiAfterStream,
    ],
  );

  return { sendMessage, stopStreaming };
}
