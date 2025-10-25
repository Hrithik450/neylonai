"use client";

import React from "react";
import { WidgetHeader } from "@/components/support-widget/widget-header";
import { ChevronRight, HelpCircle } from "lucide-react";
import { cn, shortTimeAgo } from "@/lib/utils";
import { guminertRegular } from "@/assets/fonts";
import {
  type Screen,
  TabType,
  useThreadStore,
  useUserStore,
} from "@/store/store";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadsResponse } from "@/actions/threads/threads.types";
import { WidgetChatThreadUI } from "@/components/support-widget/tabs/widget-messages/widget-chat-messages-ui";
import { robotIcons } from "@/lib/constants";

interface MessagePreviewProps {
  Icon: React.ElementType;
  sender_name: string;
  thread_title: string;
  timestamp: string;
  action: () => void;
}

function MessagePreview({
  Icon,
  thread_title,
  sender_name,
  timestamp,
  action,
}: MessagePreviewProps): React.JSX.Element {
  return (
    <div
      onClick={action}
      className="group flex items-center p-3 mx-autoshadow-sm space-x-3 cursor-pointer hover:bg-violet-100/30 transition-colors border-b-2 border-black/10"
    >
      {/* Avatar */}
      <div className="shrink-0">
        <div className="p-2 bg-gray-100 border border-gray-300 rounded-full shadow-sm">
          <Icon className="w-6 h-6 text-gray-700" />
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-slate-800 line-clamp-1">
          {thread_title}
        </p>
        <p className="text-sm text-slate-500 line-clamp-1">
          {sender_name} &bull; {timestamp}
        </p>
      </div>

      {/* Arrow Icon */}
      <ChevronRight className="w-5 h-5 group-hover:-rotate-90 transition-transform duration-300 ease-in-out mr-2" />
    </div>
  );
}

interface AskQuestionButtonProps {
  onClick?: () => void;
  className?: string;
}

function AskQuestionButton({
  onClick,
  className,
}: AskQuestionButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer flex items-center justify-between gap-2 px-4 py-2 bg-black hover:bg-black/85 hover:scale-105 text-white rounded-lg shadow-lg transition-transform",
        guminertRegular.className,
        className
      )}
    >
      {/* Text Label */}
      <h3 className="text-base">Ask a question</h3>

      {/* Icon Container: The white circular background */}
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-md">
        {/* The HelpCircle icon from lucide-react */}
        <HelpCircle
          size={22} // Standard icon size
          className="text-black"
          strokeWidth={2.5} // Thicker stroke for visibility
        />
      </div>
    </button>
  );
}

interface WidgetAssistantProps {
  pushScreen: (tab: TabType, screen: Screen) => void;
}

export function WidgetAssistant({
  pushScreen,
}: WidgetAssistantProps): React.JSX.Element {
  const [loading, setLoading] = React.useState<boolean>(false);
  const { threads, setThreads, setCurrentThreadId } = useThreadStore();
  const { currentUserId } = useUserStore();

  React.useEffect(() => {
    if (threads && threads.length > 0) return;

    const fetchThreads = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/core-manager/api/v1/threads/user/${currentUserId}/`
        );
        const data: ThreadsResponse = await res.json();

        if (!data.success) {
          setLoading(false);
          console.error("Error fetching threads:", data.error);
          return;
        }

        if (data.data) setThreads(data.data);
      } catch (error) {
        setLoading(false);
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUserId && !threads) fetchThreads();
  }, [currentUserId, threads, setThreads]);

  return (
    <section className="relative h-full">
      {/* Sticky header at the top */}
      <WidgetHeader className="sticky top-0" header="Messages" />

      {/* Scrollable message previews */}
      <div className="flex flex-col max-h-[calc(100%-72px)] h-full overflow-y-auto scrollbar-hide">
        {loading && (
          <div className="flex flex-col">
            {[...Array(12)].map((_, i) => (
              <Skeleton
                key={i}
                className="group flex items-center p-3 w-full mx-auto space-x-3 cursor-pointer transition-colors border-b-2 border-black/10"
              >
                <div className="shrink-0 h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </Skeleton>
            ))}
          </div>
        )}

        {!loading && threads && threads.length > 0 ? (
          threads.map((thread, index) => (
            <MessagePreview
              key={thread.id}
              sender_name="Assistant"
              thread_title={thread.title}
              timestamp={shortTimeAgo(thread.created_at)}
              Icon={robotIcons[index % robotIcons.length]}
              action={() =>
                pushScreen(TabType.Messages, {
                  component: WidgetChatThreadUI,
                  props: { id: thread.id, title: thread.title },
                })
              }
            />
          ))
        ) : (
          <div className="flex justify-center items-start h-full px-6 py-3">
            <p className="text-gray-500 text-md">
              No threads available. Please create one by asking a question.
            </p>
          </div>
        )}
      </div>

      {/* Sticky bottom ask question button */}
      <div className="absolute bottom-2 w-full flex justify-center z-20">
        <AskQuestionButton
          className="w-max"
          onClick={() => {
            setCurrentThreadId(null);
            pushScreen(TabType.Messages, {
              component: WidgetChatThreadUI,
              props: { id: null, title: null },
            });
          }}
        />
      </div>
    </section>
  );
}
