"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../ui";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";
import { ChevronsDown, Copy } from "lucide-react";
import { Button } from "../../ui";
import { useWidgetStore } from "../store/widget-store";
import { useWidgetHost } from "../context/widget-host";
import type { ThreadMessage } from "../..";
import { DynamicAssistantTyping } from "./assistant-typing";
import { contrastForeground } from "../color-contrast";
const markdownComponents = {
  h1({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h1 className="text-2xl md:text-3xl font-bold mb-4 mt-5" {...props} />
    );
  },
  h2({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h2 className="text-xl md:text-2xl font-semibold mb-3 mt-4" {...props} />
    );
  },
  h3({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h3 className="text-lg md:text-xl font-medium mb-2 mt-3" {...props} />
    );
  },
  h4({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h4 className="text-base md:text-lg font-medium mb-2 mt-2" {...props} />
    );
  },
  h5({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h5 className="text-sm md:text-base font-medium mb-1 mt-1" {...props} />
    );
  },
  h6({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h6 className="text-xs md:text-sm font-medium mb-1 mt-1" {...props} />
    );
  },
  li({ ...props }: React.HTMLAttributes<HTMLLIElement>) {
    return <li className="ml-4 mb-1 list-disc" {...props} />;
  },
  p({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className="mb-2 leading-relaxed last:mb-0" {...props} />;
  },
  a({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <a className="text-blue-500 hover:underline" {...props} />;
  },
};

const MessageBubble = memo(
  function MessageBubble({
    conversation,
    isStreaming,
    groupedWithPrevious,
    showActions,
    aiMessageBackground,
    humanMessageBackground,
  }: {
    conversation: ThreadMessage;
    isStreaming: boolean;
    groupedWithPrevious: boolean;
    showActions: boolean;
    aiMessageBackground: string;
    humanMessageBackground: string;
  }) {
    const copyToClipboard = useCallback(() => {
      void navigator.clipboard.writeText(conversation.content);
    }, [conversation.content]);

    if (conversation.role !== "assistant") {
      const humanText = contrastForeground(humanMessageBackground);
      return (
        <div
          className={cn(
            "flex flex-col ml-auto max-w-[75%]",
            groupedWithPrevious ? "mt-1" : "mt-3",
          )}
        >
          <p
            className="py-3 px-3 border border-black/40 text-sm md:text-base leading-snug rounded-lg rounded-br-sm"
            style={{
              backgroundColor: humanMessageBackground,
              color: humanText,
            }}
          >
            {conversation.content}
          </p>
        </div>
      );
    }

    const aiBg = aiMessageBackground.trim() || "transparent";
    const aiTransparent = /^transparent$/i.test(aiBg);
    const aiText = aiTransparent
      ? "#000000"
      : contrastForeground(aiBg);

    return (
      <div
        className={cn(
          "max-w-full [content-visibility:auto]",
          groupedWithPrevious
            ? "mt-0.5 pt-0 px-3 md:px-4"
            : "mt-2.5 px-3 py-2 md:px-4",
        )}
      >
        <div
          className={cn(
            "flex flex-col rounded-2xl rounded-bl-md px-3.5 py-2.5",
            aiTransparent && "px-0 py-0",
          )}
          style={{
            backgroundColor: aiTransparent ? "transparent" : aiBg,
            color: aiText,
          }}
        >
          <div
            className="prose max-w-none text-sm md:text-base"
            style={{ color: aiText }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={markdownComponents}
            >
              {conversation.content}
            </ReactMarkdown>
          </div>
        </div>
        {showActions && !isStreaming ? (
          <div className="flex justify-start space-x-2 mt-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copyToClipboard}
              className="text-gray-500 hover:text-gray-700 cursor-pointer"
              title="Copy"
              aria-label="Copy message"
            >
              <Copy size={18} />
            </Button>
          </div>
        ) : null}
      </div>
    );
  },
  (prev, next) =>
    prev.isStreaming === next.isStreaming &&
    prev.groupedWithPrevious === next.groupedWithPrevious &&
    prev.showActions === next.showActions &&
    prev.aiMessageBackground === next.aiMessageBackground &&
    prev.humanMessageBackground === next.humanMessageBackground &&
    prev.conversation.id === next.conversation.id &&
    prev.conversation.content === next.conversation.content &&
    prev.conversation.role === next.conversation.role,
);

export function ConversationUI({
  conversations,
}: {
  conversations?: ThreadMessage[];
}) {
  const { config } = useWidgetHost();
  const aiMessageBackground = config.branding.aiMessageBackground;
  const humanMessageBackground = config.branding.humanMessageBackground;
  const { assistantTyping, isStreaming } = useWidgetStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledUpRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const stopSmoothScroll = useCallback(() => {
    if (scrollRafRef.current != null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 64;
    if (!isAtBottom) {
      userScrolledUpRef.current = true;
      stopSmoothScroll();
    } else {
      userScrolledUpRef.current = false;
    }
    setShowScrollButton(!isAtBottom);
  };

  /** Ease toward bottom — premium follow while tokens stream. */
  const smoothFollowBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el || userScrolledUpRef.current) return;

    if (scrollRafRef.current != null) return;

    const tick = () => {
      const node = scrollRef.current;
      if (!node || userScrolledUpRef.current) {
        scrollRafRef.current = null;
        return;
      }

      const target = Math.max(0, node.scrollHeight - node.clientHeight);
      const current = node.scrollTop;
      const dist = target - current;

      if (dist <= 0.75) {
        node.scrollTop = target;
        scrollRafRef.current = null;
        setShowScrollButton(false);
        return;
      }

      // Ease-out follow (feels like manual fling, not a hard snap).
      node.scrollTop = current + dist * 0.22;
      scrollRafRef.current = requestAnimationFrame(tick);
    };

    scrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  const jumpToBottom = useCallback(() => {
    stopSmoothScroll();
    const el = scrollRef.current;
    if (!el) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }
    el.scrollTop = el.scrollHeight;
    userScrolledUpRef.current = false;
    setShowScrollButton(false);
  }, [stopSmoothScroll]);

  const last = conversations?.[conversations.length - 1];
  const lastContent = last?.content ?? "";
  const lastId = last?.id ?? "";

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    if (isStreaming || assistantTyping) {
      smoothFollowBottom();
      return;
    }
    // After a turn settles, land exactly on the bottom once.
    jumpToBottom();
  }, [
    lastContent,
    lastId,
    assistantTyping,
    isStreaming,
    smoothFollowBottom,
    jumpToBottom,
  ]);

  useEffect(() => () => stopSmoothScroll(), [stopSmoothScroll]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative flex-1 min-h-0 w-full mx-auto overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-0.5 pr-1 pt-2 md:pt-4 pb-2"
    >
      {conversations &&
        conversations.length > 0 &&
        conversations.map((conversation, index) => {
          const isLast = index === conversations.length - 1;
          const prev = conversations[index - 1];
          const next = conversations[index + 1];
          const groupedWithPrevious = Boolean(
            prev && prev.role === conversation.role,
          );
          const groupedWithNext = Boolean(
            next && next.role === conversation.role,
          );
          const showCursor =
            isLast && conversation.role === "assistant" && isStreaming;

          return (
            <div
              key={conversation.id}
              className={cn("text-sm md:text-base rounded-xl")}
            >
              <MessageBubble
                conversation={conversation}
                isStreaming={showCursor}
                groupedWithPrevious={groupedWithPrevious}
                aiMessageBackground={aiMessageBackground}
                humanMessageBackground={humanMessageBackground}
                showActions={
                  conversation.role === "assistant" && !groupedWithNext
                }
              />
            </div>
          );
        })}

      {assistantTyping && <DynamicAssistantTyping />}

      {showScrollButton && (
        <div className="sticky bottom-3 z-199 w-full flex justify-center items-center px-2 pr-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              userScrolledUpRef.current = false;
              jumpToBottom();
            }}
            className="p-1 w-fit h-auto cursor-pointer rounded-full border border-black/50 bg-gray-200 shadow-md hover:bg-gray-300 transition"
            aria-label="Scroll to bottom"
          >
            <ChevronsDown size={22} />
          </Button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
