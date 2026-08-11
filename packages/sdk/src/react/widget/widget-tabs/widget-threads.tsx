"use client";

import React from "react";
import { WidgetHeader } from "../widget-header";
import { ChevronRight, HelpCircle } from "lucide-react";
import { cn, shortTimeAgo } from "../../../ui";

import { Button } from "../../../ui";
import { robotIcons, WidgetScreens, WidgetTabs } from "../../constants";

import { useWidgetHost } from "../../context/widget-host";
import { useWidgetNavigation } from "../../hooks/use-widget-navigation";
import { useThreadStore } from "../../store/thread-store";
import { listThreads, getChatParticipantId } from "../../..";
import { WidgetLoader } from "../widget-loader";

interface ThreadPreviewProps {
  Icon: React.ElementType;
  sender_name: string;
  thread_title: string;
  timestamp: string;
  action: () => void;
}

function ThreadPreview({
  Icon,
  thread_title,
  sender_name,
  timestamp,
  action,
}: ThreadPreviewProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={action}
      className="group flex items-center p-3 w-full text-left space-x-3 cursor-pointer hover:bg-black/[0.03] transition-colors border-b border-black/10"
    >
      <div className="shrink-0">
        <div className="p-2 bg-gray-100 border border-gray-300 rounded-full shadow-sm">
          <Icon className="w-6 h-6 text-gray-700" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-slate-800 line-clamp-1">
          {thread_title}
        </p>
        <p className="text-sm text-slate-500 line-clamp-1">
          {sender_name} &bull; {timestamp}
        </p>
      </div>

      <ChevronRight className="w-5 h-5 group-hover:-rotate-90 transition-transform duration-300 ease-in-out mr-2" />
    </button>
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
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "h-auto cursor-pointer flex items-center justify-between gap-2 px-4 py-2 bg-black hover:bg-black/85 text-white rounded-lg shadow-lg transition-colors",
        className,
      )}
    >
      <span className="text-base">Ask a question</span>
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-md">
        <HelpCircle size={22} className="text-black" strokeWidth={2.5} />
      </span>
    </Button>
  );
}

export function WidgetThreads() {
  const { navigate } = useWidgetNavigation();
  const { user, config } = useWidgetHost();
  const { threads, replaceThreads, setCurrentThreadId } = useThreadStore();
  const [participantId, setParticipantId] = React.useState<string | null>(
    user?.id ?? null,
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setParticipantId(getChatParticipantId(user?.id));
  }, [user?.id]);

  React.useEffect(() => {
    // Dashboard static mock — seed list, skip network.
    if (config.staticDemo) {
      replaceThreads(config.staticDemo.threads ?? []);
      setLoading(false);
      return;
    }

    if (!participantId) return;

    let cancelled = false;
    setLoading(true);

    const fetchThreads = async () => {
      try {
        const resData = await listThreads(participantId);
        if (cancelled) return;

        if (!resData.success) {
          console.error("Error fetching threads:", resData.error);
          replaceThreads([]);
          return;
        }

        replaceThreads(resData.data ?? []);
      } catch (error) {
        if (!cancelled) {
          console.error("Fetch error:", error);
          replaceThreads([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchThreads();

    return () => {
      cancelled = true;
    };
  }, [participantId, replaceThreads, config.staticDemo]);

  const list = threads ?? [];

  return (
    <section className="relative h-full flex flex-col">
      <WidgetHeader className="sticky top-0" header="Messages" />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-16">
        {loading ? (
          <WidgetLoader
            color={config.branding.primaryTextColor}
            label="Loading conversations"
          />
        ) : list.length > 0 ? (
          list.map((thread, index) => (
            <ThreadPreview
              key={thread.id}
              sender_name="Assistant"
              thread_title={thread.title}
              timestamp={shortTimeAgo(new Date(thread.created_at))}
              Icon={robotIcons[index % robotIcons.length]}
              action={() =>
                navigate(
                  WidgetTabs.Messages,
                  WidgetScreens.MessagesScreens.Messages,
                  { threadId: thread.id, title: thread.title },
                )
              }
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[12rem] px-6 text-center">
            <p className="text-sm text-zinc-500">
              No conversations yet. Ask a question to get started.
            </p>
          </div>
        )}
      </div>

      <div className="absolute bottom-2 w-full flex justify-center z-20">
        <AskQuestionButton
          className="w-max"
          onClick={() => {
            setCurrentThreadId(null);
            navigate(
              WidgetTabs.Messages,
              WidgetScreens.MessagesScreens.Messages,
            );
          }}
        />
      </div>
    </section>
  );
}
