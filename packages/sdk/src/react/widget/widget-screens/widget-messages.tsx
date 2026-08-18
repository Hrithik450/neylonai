"use client";

import React from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { cn, Button } from "../../../ui";

import { InputForm } from "../input-form";
import { WidgetHeader } from "../widget-header";
import { ConversationUI } from "../conversation-ui";
import { WidgetLoader } from "../widget-loader";

import { useWidgetNavigation } from "../../hooks/use-widget-navigation";
import { useThreadMessageStore, useThreadStore } from "../../store/thread-store";
import { useWidgetMessageHandler } from "../../hooks/use-message-handler";
import { useWidgetHost } from "../../context/widget-host";
import { useProactivePendingStore } from "../../proactive";
import { getOrCreateVisitorId, listMessages } from "../../..";
import { useWidgetToggleStore } from "../../store/widget-store";

interface WidgetMessagesProps {
  threadId?: string;
  title?: string;
}

export function WidgetMessages({ threadId, title }: WidgetMessagesProps) {
  const [loading, setLoading] = React.useState(Boolean(threadId));

  const { messages, setMessages } = useThreadMessageStore();
  const { threads, setCurrentThreadId } = useThreadStore();
  const { config, user } = useWidgetHost();

  const { back } = useWidgetNavigation();
  const { sendMessage, stopStreaming } = useWidgetMessageHandler();
  const { isOpen } = useWidgetToggleStore();
  const pendingQuestion = useProactivePendingStore((s) => s.pendingQuestion);
  const sendMessageRef = React.useRef(sendMessage);
  const stopStreamingRef = React.useRef(stopStreaming);
  sendMessageRef.current = sendMessage;
  stopStreamingRef.current = stopStreaming;

  const emptyStarters = (config.messages.suggestedQuestions ?? []).slice(0, 3);
  const accent = config.branding.primaryTextColor;
  const secondary = config.branding.secondaryTextColor;
  const surface = config.branding.secondaryTextBackground;
  const awaitingPendingSend = Boolean(pendingQuestion);
  const showLoader =
    loading || (awaitingPendingSend && (!messages || messages.length === 0));
  const showEmpty =
    !showLoader && (!messages || messages.length === 0);
  const showConversation = !showLoader && Boolean(messages?.length);
  const activeThread = threads?.find(
    (thread) => thread.id === (threadId ?? useThreadStore.getState().currentThreadId),
  );
  const humanOwned =
    activeThread?.escalated === true ||
    activeThread?.conversation_status === "awaiting_contact" ||
    activeThread?.conversation_status === "human_pending" ||
    activeThread?.conversation_status === "human_active";

  // Home / proactive click-through → auto-send once the widget is open and ready.
  React.useEffect(() => {
    if (!isOpen || loading || !pendingQuestion) return;
    const text =
      useProactivePendingStore.getState().consumePendingQuestion();
    if (text) {
      void sendMessageRef.current(text);
    }
  }, [isOpen, loading, pendingQuestion]);

  // Bind thread + load history. Only re-fetch when threadId changes.
  React.useEffect(() => {
    let cancelled = false;

    setCurrentThreadId(threadId ?? null);

    // Dashboard static mock — seed conversation, skip network.
    if (config.staticDemo) {
      const demoMessages = config.staticDemo.messages ?? [];
      setMessages(demoMessages.length ? [...demoMessages] : []);
      setLoading(false);
      return () => {
        cancelled = true;
        stopStreamingRef.current();
      };
    }

    if (!threadId) {
      setMessages([]);
      setLoading(false);
      return () => {
        cancelled = true;
        stopStreamingRef.current();
      };
    }

    setLoading(true);

    const fetchThreadMessages = async (opts?: { silent?: boolean }) => {
      try {
        const data = await listMessages(
          threadId,
          user?.id?.trim() || getOrCreateVisitorId(),
        );
        if (cancelled) return;

        if (!data.success) {
          console.error("Error fetching thread_messages:", data.error);
          if (!opts?.silent) setMessages([]);
          return;
        }

        setMessages(data.data ?? []);
      } catch (error) {
        if (!cancelled && !opts?.silent) {
          console.error("Fetch error:", error);
          setMessages([]);
        }
      } finally {
        if (!cancelled && !opts?.silent) setLoading(false);
      }
    };

    void fetchThreadMessages();

    // While a human may be handling the same thread, poll so visitor sees replies
    // without websockets (Intercom/Zendesk use realtime; polling is enough here).
    const pollId = window.setInterval(() => {
      if (cancelled) return;
      void fetchThreadMessages({ silent: true });
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      stopStreamingRef.current();
    };
  }, [threadId, setCurrentThreadId, setMessages, config.staticDemo, user?.id]);

  return (
    <div className={cn("flex flex-col h-full min-h-0 min-w-0")}>
      <WidgetHeader
        className="sticky top-0 shrink-0"
        header={title || "New Chat"}
        action={() => back()}
      />

      <div className="relative flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {showLoader ? (
          <WidgetLoader color={accent} label="Loading conversation" />
        ) : null}

        {showEmpty ? (
          <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-center px-5 gap-4">
            <div className="space-y-1.5 max-w-sm">
              <h2
                className="text-lg font-semibold"
                style={{ color: accent }}
              >
                Ask anything
              </h2>
              <p
                className="text-sm flex items-center justify-center gap-1.5"
                style={{ color: secondary }}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Answers grounded in{" "}
                {config.branding.name?.trim()
                  ? `${config.branding.name.trim()}'s knowledge`
                  : "your knowledge"}
              </p>
            </div>
            {emptyStarters.length > 0 ? (
              <div className="w-full max-w-sm flex flex-col gap-2">
                {emptyStarters.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    onClick={() => void sendMessage(question)}
                    className="h-auto cursor-pointer justify-between gap-3 rounded-xl border border-black/10 px-3.5 py-2.5 text-left shadow-none hover:opacity-95"
                    style={{ backgroundColor: surface }}
                  >
                    <span
                      className="text-sm font-medium leading-snug"
                      style={{ color: accent }}
                    >
                      {question}
                    </span>
                    <ArrowRight
                      className="w-4 h-4 shrink-0"
                      style={{ color: secondary }}
                    />
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showConversation ? (
          <ConversationUI conversations={messages ?? []} />
        ) : null}
      </div>

      <div className="relative min-w-0 shrink-0">
        {humanOwned ? (
          <div className="border-t border-black/10 px-4 py-3 text-center text-xs text-zinc-500">
            This conversation is with the support team. AI replies are paused.
          </div>
        ) : (
          <InputForm sendMessage={sendMessage} stopStreaming={stopStreaming} />
        )}
      </div>
    </div>
  );
}
