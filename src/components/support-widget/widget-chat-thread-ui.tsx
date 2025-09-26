"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { InputForm } from "@/components/support-widget/input-form";
import { ConversationUI } from "@/components/support-widget/conversation-ui";
import {
  useAssistantStore,
  useInputStore,
  useThreadStore,
  useUserStore,
} from "@/store/store";
import { useRouter } from "next/navigation";
import { Thread } from "@/actions/threads/threads.types";
import { WidgetHeader } from "@/components/support-widget/widget-header";

interface WidgetChatUIProps {
  id: string;
  title: string;
  pushScreen: (screen: Screen) => void;
  popScreen: () => void;
}

interface ConversationsProps {
  role: string;
  content: string;
}

export function WidgetChatThreadUI({
  id,
  title,
  pushScreen,
  popScreen,
}: WidgetChatUIProps) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [conversations, setConversations] = React.useState<
    ConversationsProps[] | null
  >(null);

  const { currentUserId } = useUserStore();
  const { currentThreadId, setCurrentThreadId, setThreads } = useThreadStore();
  const { setIsAssistantTyping } = useAssistantStore();
  const { input, setInput, setDisableInput } = useInputStore();
  const router = useRouter();

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
      console.log("userid not available");
      return;
    }

    const newMessage = { role: "user", content: input };
    setConversations((prev) => [...(prev || []), newMessage]);

    setInput("");
    setDisableInput(true);
    setIsAssistantTyping(true);

    try {
      const response = await fetch(`api/model/text-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: input,
          threadId: currentThreadId,
          senderId: currentUserId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("No response stream");
      }

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
                setThreads(thread);
                if (thread.id) setCurrentThreadId(thread.id);
                break;

              case "assistantTyping":
                setIsAssistantTyping(data === "true" ? true : false);
                break;

              case "assistantResponseCompleted":
                const { threadId } = JSON.parse(data);
                if (threadId) {
                  router.push(`/c/${threadId}`);
                }

                // await autoSpeak(assistantResponse);
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
            setIsAssistantTyping(false);
            const chunk = event.replace(/^data:\s?/, "");

            setConversations((prev) => {
              if (!prev) return [{ role: "assistant", content: chunk }];
              const last = prev[prev.length - 1];

              if (last?.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: last.content + chunk },
                ];
              }
              return [...prev, { role: "assistant", content: chunk }];
            });
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
        header={title}
        action={() => popScreen()}
      />

      {!conversations && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-lg font-semibold mb-1">No conversations yet</h2>
          <p className="text-sm text-gray-500">
            Start a conversation to see it appear here.
          </p>
        </div>
      )}

      {conversations && conversations?.length > 0 && (
        <ConversationUI conversations={conversations} />
      )}

      <InputForm handleSendMessage={handleSendMessage} />
    </div>
  );
}
