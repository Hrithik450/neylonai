"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { InputForm } from "@/components/support-widget/input-form";
import { ConversationUI } from "@/components/support-widget/conversation-ui";
import {
  TabType,
  type Screen,
  useAssistantStore,
  useInputStore,
  useThreadMessageStore,
  useThreadStore,
  useUserStore,
} from "@/store/store";
import { Thread } from "@/actions/threads/threads.types";
import { WidgetHeader } from "@/components/support-widget/widget-header";
import { MessagesResponse } from "@/actions/thread_messages/thread_messages.types";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassicLoader } from "@/components/classic-loader";
import { messageSets } from "@/lib/constants";
import { useSessionStore } from "@/store/session-store";

interface WidgetChatUIProps {
  id: string;
  title: string;
  popScreen: () => void;
  pushScreen: (tab: TabType, screen: Screen) => void;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setStatus: React.Dispatch<
    React.SetStateAction<"error" | "saving" | "saved" | null>
  >;
}

export function WidgetChatThreadUI({
  id,
  title,
  popScreen,
  setMessage,
  setStatus,
}: WidgetChatUIProps) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [limitReached, setLimitReached] = React.useState<string | null>(null);

  const { currentUserId, tokens, resumeTokens, setTokens, assistant } =
    useUserStore();
  const { currentThreadId, setCurrentThreadId, setThreads } = useThreadStore();
  const { messages, updateMessage, setMessages } = useThreadMessageStore();
  const { input, setInput, setDisableInput, setFile } = useInputStore();
  const { setAssistantTyping, setThinkingPhase } = useAssistantStore();
  const { file } = useInputStore();

  const { user, isAuthenticated } = useSessionStore();

  React.useEffect(() => {
    const fetchThreadMessages = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/core-manager/api/v1/thread_messages/${id}/`,
        );
        const data: MessagesResponse = await res.json();

        if (!data.success) {
          setLoading(false);
          console.error("Error fetching thread_messages:", data.error);
          return;
        }

        if (data.data) setMessages(data.data);
      } catch (error) {
        setLoading(false);
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id && (!messages || currentThreadId !== id)) fetchThreadMessages();
  }, [id, currentThreadId, setMessages]);

  React.useEffect(() => {
    setCurrentThreadId(id);
    if (!id || !currentThreadId) setMessages([]);
  }, [id]);

  React.useEffect(() => {
    if (["resume_assistant"].includes(assistant) && resumeTokens <= 0)
      setLimitReached("You’ve hit today’s resume limit. Resets at 00:00.");

    if (tokens <= 0)
      setLimitReached(
        "You've reached your daily usage limit. Access will reset at 00:00",
      );
  }, [tokens, resumeTokens]);

  const handleSendMessage = async () => {
    if (!currentUserId) {
      setStatus("error");
      setMessage(
        "Please sign in to continue the conversation with our assistant.",
      );
      return;
    }

    if (["resume_assistant"].includes(assistant) && resumeTokens <= 0) {
      setStatus("error");
      setMessage("You’ve hit today’s resume limit. Resets at 00:00.");
      return;
    }

    if (tokens <= 0) {
      setStatus("error");
      setMessage(
        "You've reached your daily usage limit. Access will reset at 00:00",
      );
      return;
    }

    updateMessage((prev) => {
      if (!prev || prev.length === 0)
        return [{ role: "user", content: input, threadId: id }];
      return [...prev, { role: "user", content: input, threadId: id }];
    });

    setInput("");
    setDisableInput(true);
    setAssistantTyping(true);

    try {
      let response: Response | null = null;

      switch (assistant) {
        case "customer_service_assistant":
        case "internal_assistant":
          response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/internal-assistant/api/v1/text-generation/`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userMessage: input,
                threadId: currentThreadId,
                senderId: currentUserId,
              }),
            },
          );
          break;

        case "resume_assistant":
          const formData = new FormData();
          formData.append("userMessage", input);
          formData.append("senderId", currentUserId);
          if (currentThreadId) formData.append("threadId", currentThreadId);
          if (file) formData.append("file", file);

          response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/resume-assistant/api/v1/generate-resume/`,
            {
              method: "POST",
              body: formData,
            },
          );
          break;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setAssistantTyping(false);
        setStatus("error");
        setMessage(
          errorData?.error || "An unexpected error occurred. Please try again.",
        );
        console.error(errorData?.error);
        return;
      }

      if (!response.body) throw new Error("No response stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let pendingBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const buffer = decoder.decode(value, { stream: true });
        const events = buffer.split("<|END_OF_EVENT|>");

        if (events[0].startsWith("event: ")) {
          const dataLines = events[0].split("<|EVENT_BREAK|>");
          const eventType = dataLines[0].replace(/^event:\s?/, "");
          const dataValue = dataLines[1].replace(/^data:\s?/, "");

          switch (eventType) {
            case "threadCreated":
              const thread: Thread = JSON.parse(dataValue);
              if (thread) setThreads(thread);
              if (thread.id) setCurrentThreadId(thread.id);
              break;

            case "tokensUpdated":
              const user = JSON.parse(dataValue);
              const tokens = ["resume_assistant"].includes(assistant)
                ? user.resume_generation_limit
                : user.daily_limit;

              setTokens(tokens);
              break;

            case "thinkingPhase":
              const thinking: {
                thinking: string;
                thinkingPhase: keyof typeof messageSets;
              } = JSON.parse(dataValue);
              setAssistantTyping(thinking.thinking === "true");
              setThinkingPhase(thinking.thinkingPhase);
              break;

            case "fileUrls":
              const data: { type: string; url: string } = JSON.parse(dataValue);
              if (data.type === "generated") setAssistantTyping(false);

              updateMessage((prev) => {
                if (!prev?.length) return prev;
                const last = prev[prev.length - 1];
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    file_url: data.url,
                  },
                ];
              });

              if (data.type === "original") setFile(null);
              break;

            case "assistantResponse":
              setAssistantTyping(false);
              pendingBuffer += dataValue;

              const doubleStarMatches = (pendingBuffer.match(/\*\*/g) || [])
                .length;
              const hasUnclosedBold = doubleStarMatches % 2 !== 0;

              if (!hasUnclosedBold) {
                accumulatedText += pendingBuffer;
                pendingBuffer = "";

                updateMessage((prev) => {
                  if (!prev || prev.length === 0)
                    return [
                      {
                        role: "assistant",
                        content: accumulatedText,
                        threadId: currentThreadId as string,
                      },
                    ];

                  const last = prev[prev.length - 1];
                  if (last.role === "assistant")
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: accumulatedText },
                    ];

                  return [
                    ...prev,
                    {
                      role: "assistant",
                      content: accumulatedText,
                      threadId: currentThreadId as string,
                    },
                  ];
                });
              }

            case "done":
              setDisableInput(false);
              setAssistantTyping(false);
              break;

            case "humanError":
              console.error(dataValue);
              setDisableInput(false);
              setAssistantTyping(false);
              setStatus("error");
              setMessage(dataValue);
              break;

            case "error":
              console.error(dataValue);
              setDisableInput(false);
              setAssistantTyping(false);
              setStatus("error");
              setMessage(dataValue);
              break;
          }
        }
      }
    } catch (error) {
      console.error("Streaming fetch error", error);
      setDisableInput(false);
      setAssistantTyping(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={cn("flex flex-col justify-center items-center h-full")}>
        <ClassicLoader />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col justify-center h-full")}>
      <WidgetHeader
        className="sticky top-0"
        header={title || "New Chat"}
        action={() => popScreen()}
      />

      {/* Skeleton  */}
      {loading && (
        <div className="flex-1 h-full w-full max-w-3xl mx-auto p-2 md:p-4 space-y-4">
          {/* Assistant Message */}
          <div className="bg-gray-200/80 ml-auto rounded-xl p-4 max-w-[80%] w-fit">
            <Skeleton className="h-4 w-56 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>

          {/* User Message */}
          <div className="bg-gray-200/80 mr-auto rounded-xl p-4 max-w-[80%] w-fit">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>

          {/* Assistant Message */}
          <div className="bg-gray-200/80 ml-auto rounded-xl p-4 max-w-[80%] w-fit">
            <Skeleton className="h-4 w-60 mb-2" />
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-4 w-36" />
          </div>

          {/* User Message */}
          <div className="bg-gray-200/80 mr-auto rounded-xl p-4 max-w-[80%] w-fit">
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      )}

      {/* Starter Template */}
      {!loading && (!messages || messages.length === 0) && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-lg font-semibold mb-1">No conversations yet</h2>
          <p className="text-sm text-gray-500">
            Start a conversation to see it appear here.
          </p>
        </div>
      )}

      {/* Main Conversation Messages */}
      {!loading && messages && messages.length > 0 && (
        <ConversationUI conversations={messages} />
      )}

      <div className="relative">
        <div
          className={cn(
            "flex justify-center items-start absolute bottom-26 md:bottom-23 left-0 right-0 w-[87%] mx-auto rounded-t-xl border border-red-300 bg-linear-to-r from-red-50 to-red-100 px-3 py-2 pb-3 text-sm text-center shadow-md backdrop-blur-md transition-all duration-500 ease-out",
            limitReached
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-sm font-medium text-gray-700">{limitReached}</p>
        </div>
        <InputForm handleSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
