"use client";

import React from "react";
import { cn } from "@/lib/utils";

import { Skeleton } from "@/components/ui/skeleton";
import { InputForm } from "@/components/widget/input-form";
import { WidgetHeader } from "@/components/widget/widget-header";
import { ConversationUI } from "@/components/widget/conversation-ui";

import { useWidgetNavigation } from "@/hooks/use-widget-navigation";
import { useThreadMessageStore, useThreadStore } from "@/store/thread-store";

import { useWidgetMessageHandler } from "@/hooks/use-message-handler";

import { ThreadMessagesRespone } from "@/lib/types/types";
import { BASE_URL } from "@/lib/services/google-auth";

interface WidgetMessagesProps {
  threadId: string;
  title: string;
}

export function WidgetMessages({ threadId, title }: WidgetMessagesProps) {
  const [loading, setLoading] = React.useState<boolean>(false);

  const { messages, setMessages } = useThreadMessageStore();
  const { currentThreadId, setCurrentThreadId } = useThreadStore();

  const { back } = useWidgetNavigation();
  const { sendMessage } = useWidgetMessageHandler();

  React.useEffect(() => {
    setCurrentThreadId(threadId);
    if (!threadId || !currentThreadId) setMessages([]);
  }, [threadId]);

  React.useEffect(() => {
    const fetchThreadMessages = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${BASE_URL}/api/v1/thread_messages/${threadId}/`,
        );
        const data: ThreadMessagesRespone = await res.json();

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

    if (threadId && (!messages || currentThreadId !== threadId))
      fetchThreadMessages();
  }, [threadId, currentThreadId, setMessages]);

  return (
    <div className={cn("flex flex-col justify-center h-full")}>
      <WidgetHeader
        className="sticky top-0"
        header={title || "New Chat"}
        action={() => back()}
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
        {/* <div
          className={cn(
            "flex justify-center items-start absolute bottom-26 md:bottom-23 left-0 right-0 w-[87%] mx-auto rounded-t-xl border border-red-300 bg-linear-to-r from-red-50 to-red-100 px-3 py-2 pb-3 text-sm text-center shadow-md backdrop-blur-md transition-all duration-500 ease-out",
            limitReached
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-sm font-medium text-gray-700">{limitReached}</p>
        </div> */}

        <InputForm sendMessage={sendMessage} />
      </div>
    </div>
  );
}
