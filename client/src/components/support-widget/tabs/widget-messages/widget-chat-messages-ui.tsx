"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { InputForm } from "@/components/support-widget/input-form";
import { ConversationUI } from "@/components/support-widget/conversation-ui";
import {
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

interface WidgetChatUIProps {
  id: string;
  title: string;
  popScreen: () => void;
  pushScreen: (screen: Screen) => void;
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

  const { currentUserId, tokens, setTokens } = useUserStore();
  const { currentThreadId, setCurrentThreadId, setThreads } = useThreadStore();
  const { messages, updateMessage, setMessages } = useThreadMessageStore();
  const { input, setInput, setDisableInput } = useInputStore();
  const { setIsAssistantTyping } = useAssistantStore();
  const [limitReached, setLimitReached] = React.useState(false);

  React.useEffect(() => {
    const fetchThreadMessages = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/thread_messages/${id}/`
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
  }, [id, currentThreadId, messages, setMessages]);

  React.useEffect(() => {
    setCurrentThreadId(id);
    if (!id || !currentThreadId) setMessages([]);
  }, [id, currentThreadId, setCurrentThreadId, setMessages]);

  React.useEffect(() => {
    if (tokens <= 0) setLimitReached(true);
  }, [tokens]);

  // const autoSpeak = async (text: string) => {
  //   try {
  //     const res = await fetch("/api/model/text-to-speech", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ text }),
  //     });

  //     if (!res.ok) {
  //       throw new Error("Failed to get audio");
  //     }

  //     const blob = await res.blob();
  //     const audioUrl = URL.createObjectURL(blob);
  //     const audio = new Audio(audioUrl);
  //     audio.play();

  //     audio.onended = () => {
  //       setDisableInput(false);
  //     };
  //     return audioUrl;
  //   } catch (error) {
  //     console.error("Speak error:", error);
  //   }
  // };

  const handleSendMessage = async () => {
    if (!currentUserId) {
      setStatus("error");
      setMessage(
        "Please sign in to continue the conversation with our assistant."
      );
      return;
    }

    if (tokens <= 0) {
      setStatus("error");
      setMessage(
        "You've reached your daily usage limit. Access will reset at 00:00"
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
    setIsAssistantTyping(true);

    if (!process.env.NEXT_PUBLIC_BACKEND_URL) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/text-generation/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: input,
            threadId: currentThreadId,
            senderId: currentUserId,
          }),
        }
      );

      if (!response.ok || !response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");

        for (const event of events) {
          if (!event.trim()) continue;

          if (event.startsWith("event: ")) {
            const [eventLine, dataLine] = event.split("\n");
            const eventType = eventLine.replace("event: ", "").trim();
            const data = dataLine.replace("data: ", "").trim();

            switch (eventType) {
              case "threadCreated":
                const thread: Thread = JSON.parse(data);
                if (thread) setThreads(thread);
                if (thread.id) setCurrentThreadId(thread.id);
                break;

              case "tokensUpdated":
                const user = JSON.parse(data);
                if (user) setTokens(user.daily_limit);
                break;

              case "assistantTyping":
                setIsAssistantTyping(data === "true" ? true : false);
                break;

              case "assistantResponseCompleted":
                setIsAssistantTyping(false);
                const { assistantResponse } = JSON.parse(data);

                updateMessage((prev) => {
                  if (!prev || prev.length === 0)
                    return [
                      {
                        role: "assistant",
                        content: assistantResponse,
                        threadId: id,
                      },
                    ];

                  return [
                    ...prev,
                    {
                      role: "assistant",
                      content: assistantResponse,
                      threadId: id,
                    },
                  ];
                });
                break;

              case "done":
                setDisableInput(false);
                break;

              case "error":
                console.error("SSE error", data);
                setDisableInput(false);
                break;
            }
          } else if (event.startsWith("data: ")) {
            // setIsAssistantTyping(false);
            // const chunk = event.replace(/^data:\s?/, "");
          }
        }

        buffer = "";
      }
    } catch (error) {
      console.error("Streaming fetch error", error);
      setDisableInput(false);
      setIsAssistantTyping(false);
    }
  };

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
            "flex justify-between items-start absolute bottom-18 left-0 right-0 w-[87%] mx-auto rounded-t-xl border border-red-300 bg-gradient-to-r from-red-50 to-red-100 px-3 py-2 pb-3 text-sm text-center shadow-md backdrop-blur-md transition-all duration-500 ease-out",
            limitReached
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-5"
          )}
        >
          <p className="text-sm font-medium text-gray-700">
            You&apos;ve reached your daily usage limit. Access will reset at
            00:00
          </p>
        </div>
        <InputForm handleSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
