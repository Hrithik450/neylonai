"use client";

import { useCallback, useEffect, useRef, startTransition } from "react";
import { useInputStore } from "../store/input-store";
import {
  useWidgetNavigationStore,
  useWidgetStore,
} from "../store/widget-store";
import { WidgetTabs } from "../constants";
import { useWidgetHost } from "../context/widget-host";
import { useThreadMessageStore, useThreadStore } from "../store/thread-store";
import { flushStreamToken } from "./stream-token-buffer";
import { createSmoothStreamWriter } from "./smooth-stream-writer";
import {
  getOrCreateVisitorId,
  getTrackedPageSection,
  isAbortError,
  streamChat,
} from "../..";
import { buildStreamChatUser } from "../../chat-user";

export function useWidgetMessageHandler() {
  const { user, onError, config } = useWidgetHost();
  const { updateMessage } = useThreadMessageStore();
  const { setInput, setDisableInput } = useInputStore();
  const { setCurrentThreadId, setThreads } = useThreadStore();
  const { setAssistantTyping, setIsStreaming, setThinkingTips } = useWidgetStore();

  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const writerRef = useRef<ReturnType<typeof createSmoothStreamWriter> | null>(null);
  const sessionThreadIdRef = useRef<string | null>(useThreadStore.getState().currentThreadId);

  const resetUiAfterStream = useCallback(() => {
    inFlightRef.current = false;
    setDisableInput(false);
    setAssistantTyping(false);
    setIsStreaming(false);
    setThinkingTips([]);
  }, [setDisableInput, setAssistantTyping, setIsStreaming, setThinkingTips]);

  const bindThreadId = useCallback((id: string | null) => {
    sessionThreadIdRef.current = id;
    setCurrentThreadId(id);
  }, [setCurrentThreadId]);

  useEffect(() => useThreadStore.subscribe((state, prev) => {
    if (state.currentThreadId !== prev.currentThreadId) {
      sessionThreadIdRef.current = state.currentThreadId;
    }
  }), []);

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

  useEffect(() => () => {
    streamIdRef.current += 1;
    writerRef.current?.dispose();
    writerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
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
      const userMessageId = crypto.randomUUID();
      let assistantCreated = false;
      let pendingFence = "";
      /** Bumped on reset so paints queued for a discarded round are dropped. */
      let bubbleSeq = 0;

      // Always read latest thread id (avoid stale hook closure after interrupt).
      const threadIdForRequest =
        sessionThreadIdRef.current ??
        useThreadStore.getState().currentThreadId;

      const paint = (displayed: string) => {
        if (isStale() || !displayed) return;
        const seq = bubbleSeq;
        startTransition(() => {
          if (seq !== bubbleSeq || isStale()) return;
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
        maxCharsPerFrame: 4,
      });
      writerRef.current = writer;

      updateMessage((prev) => [
        ...(prev ?? []),
        {
          role: "user",
          content: text,
          id: userMessageId,
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
        const chatUser = buildStreamChatUser({
          id: user?.id,
          name: user?.name,
          email: user?.email,
          profile_image: user?.profile_image,
          anonymousVisitorId: getOrCreateVisitorId(),
        });
        const pageQuery =
          typeof window === "undefined"
            ? {}
            : Object.fromEntries(
                [...new URLSearchParams(window.location.search).entries()]
                  .filter(
                    ([key, value]) =>
                      !/token|key|secret|password|email|auth/i.test(key) &&
                      value.length <= 120,
                  )
                  .slice(0, 10),
              );

        for await (const payload of streamChat({
          input: text,
          user: chatUser,
          threadId: threadIdForRequest,
          pagePath:
            config.pagePath ??
            (typeof window === "undefined" ? null : window.location.pathname),
          pageQuery,
          pageSection: getTrackedPageSection(),
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

            case "assistantReset": {
              // That round was a tool call, not the answer. Drop its text and
              // go back to the thinking state until the real answer streams.
              bubbleSeq += 1;
              pendingFence = "";
              writer.reset();
              if (assistantCreated) {
                assistantCreated = false;
                updateMessage((prev) =>
                  (prev ?? []).filter((message) => message.id !== assistantId),
                );
              }
              setIsStreaming(false);
              setAssistantTyping(true);
              break;
            }

            case "conversationEscalated": {
              const id = sessionThreadIdRef.current;
              if (id) {
                const existing =
                  useThreadStore.getState().threads?.find((t) => t.id === id) ??
                  null;
                if (existing) {
                  setThreads({
                    ...existing,
                    escalated: true,
                    conversation_status:
                      payload.data.status === "human_active"
                        ? "human_active"
                        : "human_pending",
                  });
                }
              }
              break;
            }

            case "handoffContactRequired": {
              const id = payload.data.threadId;
              bindThreadId(id);
              const existing =
                useThreadStore.getState().threads?.find((t) => t.id === id) ??
                null;
              if (existing) {
                setThreads({
                  ...existing,
                  escalated: false,
                  conversation_status: "awaiting_contact",
                });
              }
              useWidgetNavigationStore.getState().switchTab(WidgetTabs.Contact);
              break;
            }

            case "messagePersisted": {
              updateMessage((messages) =>
                messages.map((message) => {
                  if (message.id === userMessageId) {
                    return { ...message, id: payload.data.userMessageId };
                  }
                  if (message.id === assistantId) {
                    return { ...message, id: payload.data.assistantMessageId };
                  }
                  return message;
                }),
              );
              break;
            }

            case "done":
              await finishOwnedWriter();
              break;

            case "error": {
              const detail =
                payload.data.blocked === "credits" && payload.data.upgrade?.detail
                  ? `${payload.data.error} ${payload.data.upgrade.detail}`
                  : payload.data.error;
              await finishOwnedWriter({ reportError: detail });
              break;
            }
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
      config.pagePath,
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
