"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { cn } from "../../ui";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";
import { ChevronsDown, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "../../ui";
import { useWidgetStore } from "../store/widget-store";
import { useWidgetHost } from "../context/widget-host";
import type { ThreadMessage } from "../..";
import { DynamicAssistantTyping } from "./assistant-typing";
import { getOrCreateVisitorId, submitMessageFeedback } from "../..";
const mkEl = (tag: string, cls: string) => (props: any) =>
  React.createElement(tag, { className: cls, ...props });

const MemoizedMarkdown = memo(
  function MemoizedMarkdown({
    content,
    remarkPlugins,
    components,
  }: {
    content: string;
    remarkPlugins: any[];
    components: any;
  }) {
    return (
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    );
  },
  (prev, next) => prev.content === next.content,
);

const markdownComponents = {
  h1: mkEl("h1", "text-2xl md:text-3xl font-bold mb-4 mt-5"),
  h2: mkEl("h2", "text-xl md:text-2xl font-semibold mb-3 mt-4"),
  h3: mkEl("h3", "text-lg md:text-xl font-medium mb-2 mt-3"),
  h4: mkEl("h4", "text-base md:text-lg font-medium mb-2 mt-2"),
  h5: mkEl("h5", "text-sm md:text-base font-medium mb-1 mt-1"),
  h6: mkEl("h6", "text-xs md:text-sm font-medium mb-1 mt-1"),
  ul: mkEl("ul", "my-2 list-disc space-y-1 pl-5"),
  ol: mkEl("ol", "my-2 list-decimal space-y-1 pl-5"),
  li: mkEl("li", "mb-1 pl-0.5"),
  p: mkEl(
    "p",
    "mb-2 leading-relaxed last:mb-0 break-words [overflow-wrap:anywhere]",
  ),
  a: (props: any) =>
    React.createElement("a", {
      className: "hover:underline",
      style: { color: "var(--wg-link, #2563eb)" },
      ...props,
    }),
};

const MessageBubble = memo(
  function MessageBubble({
    conversation,
    isStreaming,
    groupedWithPrevious,
    groupedWithNext,
    showActions,
    aiMessageBackground,
    humanMessageBackground,
  }: {
    conversation: ThreadMessage;
    isStreaming: boolean;
    groupedWithPrevious: boolean;
    groupedWithNext?: boolean;
    showActions: boolean;
    aiMessageBackground: string;
    humanMessageBackground: string;
  }) {
    const { user, config } = useWidgetHost();
    const {
      tabActiveColor,
      secondaryTextColor,
      borderColor,
      surfaceColor,
      primaryTextColor,
      aiText,
      humanText,
    } = config.branding;
    const [rating, setRating] = useState<"up" | "down" | null>(null);
    const [comment, setComment] = useState("");
    const copyToClipboard = useCallback(() => {
      void navigator.clipboard.writeText(conversation.content);
    }, [conversation.content]);

    const sendFeedback = useCallback(
      async (helpful: boolean, note?: string) => {
        const next = helpful ? "up" : "down";
        setRating(next);
        const result = await submitMessageFeedback({
          messageId: conversation.id,
          visitorId: user?.id?.trim() || getOrCreateVisitorId(),
          helpful,
          comment: note?.trim() || null,
        });
        if (!result.success) setRating(null);
      },
      [conversation.id, user?.id],
    );

    const isTeamMessage =
      conversation.role === "assistant" || conversation.role === "human";
    if (!isTeamMessage) {
      return (
        <div className="flex min-w-0 max-w-[75%] flex-col ml-auto">
          <p
            className="m-0 px-4 py-2.5 border text-sm md:text-base leading-snug break-words [overflow-wrap:anywhere] shadow-lg"
            style={{
              margin: 0,
              backgroundColor: humanMessageBackground,
              color: humanText,
              borderColor,
              borderTopLeftRadius: "1.35rem",
              borderBottomLeftRadius: "1.35rem",
              borderTopRightRadius: groupedWithPrevious ? "4px" : "1.35rem",
              borderBottomRightRadius: groupedWithNext ? "4px" : "1.35rem",
            }}
          >
            {conversation.content}
          </p>
        </div>
      );
    }

    const aiBg = aiMessageBackground.trim() || "transparent";
    const aiTransparent = /^transparent$/i.test(aiBg);

    return (
      <div
        className={cn(
          "max-w-full min-w-0 [content-visibility:auto] px-3 md:px-2"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col rounded-2xl border px-4 py-3 shadow-lg",
            aiTransparent && "px-0 py-0 rounded-none border-none shadow-none",
          )}
          style={{
            backgroundColor: aiTransparent ? "transparent" : aiBg,
            borderColor: aiTransparent ? "transparent" : borderColor,
            color: aiText,
          }}
        >
          <div
            className="prose max-w-none min-w-0 w-full break-words text-sm md:text-base [overflow-wrap:anywhere]"
            style={{ color: aiText, ["--wg-link" as any]: tabActiveColor }}
          >
            <MemoizedMarkdown
              content={conversation.content}
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={markdownComponents}
            />
          </div>
        </div>
        {showActions && !isStreaming ? (
          <div className="flex justify-start space-x-2 mt-2 -ml-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copyToClipboard}
              className="cursor-pointer !bg-transparent !border-none !shadow-none hover:opacity-80 transition-opacity"
              style={{ color: secondaryTextColor }}
              title="Copy"
              aria-label="Copy message"
            >
              <Copy size={18} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void sendFeedback(true)}
              className="cursor-pointer !bg-transparent !border-none !shadow-none hover:opacity-80 transition-opacity"
              style={{ color: rating === "up" ? "#047857" : secondaryTextColor }}
              title="Helpful"
              aria-label="Mark answer helpful"
              aria-pressed={rating === "up"}
            >
              <ThumbsUp size={17} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void sendFeedback(false)}
              className="cursor-pointer !bg-transparent !border-none !shadow-none hover:opacity-80 transition-opacity"
              style={{
                color: rating === "down" ? "#dc2626" : secondaryTextColor,
              }}
              title="Not helpful"
              aria-label="Mark answer unhelpful"
              aria-pressed={rating === "down"}
            >
              <ThumbsDown size={17} />
            </Button>
          </div>
        ) : null}
        {showActions && !isStreaming && rating === "down" ? (
          <form
            className="mt-1 flex max-w-sm gap-2 px-1"
            onSubmit={(event) => {
              event.preventDefault();
              void sendFeedback(false, comment);
            }}
          >
            <input
              value={comment}
              maxLength={500}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What was missing? (optional)"
              className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs"
              style={{
                backgroundColor: surfaceColor,
                color: primaryTextColor,
                borderColor,
              }}
            />
            <Button type="submit" size="sm" variant="outline">
              Send
            </Button>
          </form>
        ) : null}
      </div>
    );
  },
  (prev, next) => {
    // Only re-render if content actually changed
    const contentChanged =
      prev.conversation.content !== next.conversation.content;
    // Or if any of these props changed
    const propsChanged =
      prev.isStreaming !== next.isStreaming ||
      prev.groupedWithPrevious !== next.groupedWithPrevious ||
      prev.showActions !== next.showActions ||
      prev.aiMessageBackground !== next.aiMessageBackground ||
      prev.humanMessageBackground !== next.humanMessageBackground;

    // If content hasn't changed and no props changed, skip re-render
    if (!contentChanged && !propsChanged) {
      return true; // Don't re-render (React.memo returns true when equal)
    }

    // Also check if it's the same message
    if (prev.conversation.id !== next.conversation.id) {
      return false; // Different message, re-render
    }

    // Same message, but something changed, re-render
    return false;
  },
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
  const prevContentRef = useRef<string>("");
  const scrollThrottleRef = useRef(false);

  const stopSmoothScroll = useCallback(() => {
    if (scrollRafRef.current != null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || scrollThrottleRef.current) return;

    scrollThrottleRef.current = true;
    requestAnimationFrame(() => {
      scrollThrottleRef.current = false;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current!;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 64;
      if (!isAtBottom) {
        userScrolledUpRef.current = true;
        stopSmoothScroll();
      } else {
        userScrolledUpRef.current = false;
      }
      setShowScrollButton(!isAtBottom);
    });
  }, [stopSmoothScroll]);

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

      node.scrollTop = current + dist * 0.22;
      scrollRafRef.current = requestAnimationFrame(tick);
    };

    scrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  const jumpToBottom = useCallback(() => {
    stopSmoothScroll();
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = scrollRef.current;
        if (!el) {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
          return;
        }
        el.scrollTop = el.scrollHeight;
        
        // Check if it's actually at the bottom now
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 64;
        setShowScrollButton(!isAtBottom);
        userScrolledUpRef.current = false;
      }, 0);
    });
  }, [stopSmoothScroll]);

  const last = conversations?.[conversations.length - 1];
  const lastContent = last?.content ?? "";
  const lastId = last?.id ?? "";

  const hasPopulatedRef = useRef(false);
  const firstMessageIdRef = useRef(conversations?.[0]?.id);

  if (conversations?.[0]?.id !== firstMessageIdRef.current) {
    firstMessageIdRef.current = conversations?.[0]?.id;
    hasPopulatedRef.current = false;
  }

  useLayoutEffect(() => {
    if (conversations && conversations.length > 0 && !hasPopulatedRef.current) {
      hasPopulatedRef.current = true;
      userScrolledUpRef.current = false; // Force reset ignoring rogue scrolls
      jumpToBottom();
      return;
    }

    if (userScrolledUpRef.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 64;

    if (isStreaming || assistantTyping) {
      // During streaming, jump immediately to keep content visible
      // But only if we're already near the bottom or content is actively updating
      if (isAtBottom || lastContent !== prevContentRef.current) {
        jumpToBottom();
      }
      prevContentRef.current = lastContent;
      return;
    }

    // After a turn settles, land exactly on the bottom once.
    jumpToBottom();
  }, [conversations, lastContent, lastId, assistantTyping, isStreaming, jumpToBottom]);

  useEffect(() => () => stopSmoothScroll(), [stopSmoothScroll]);

  const visibleConversations = useMemo(() => {
    const visible = (conversations ?? []).filter((c, i) => {
      if (c.content && c.content.trim().length > 0) return true;
      if (i === (conversations ?? []).length - 1 && c.role === "assistant" && isStreaming) return true;
      return false;
    });
    console.log("[ConversationUI] visibleConversations length:", visible.length, visible);
    return visible;
  }, [conversations, isStreaming]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative flex-1 min-h-0 min-w-0 w-full mx-auto overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-3 md:px-4 pt-2 md:pt-4 pb-2"
    >
      {visibleConversations.length > 0 &&
        (() => {
          const clusters: { role: string; messages: typeof visibleConversations }[] = [];
          for (const c of visibleConversations) {
            const lastCluster = clusters[clusters.length - 1];
            if (!lastCluster || lastCluster.role !== c.role) {
              clusters.push({ role: c.role, messages: [c] });
            } else {
              lastCluster.messages.push(c);
            }
          }

          return clusters.map((cluster, clusterIndex) => (
            <div
              key={`cluster-${clusterIndex}`}
              className={cn("flex flex-col mb-5", cluster.role === "user" ? "gap-0.5" : "gap-3")}
            >
              {cluster.messages.map((conversation, indexInCluster) => {
                const isLastInCluster = indexInCluster === cluster.messages.length - 1;
                const isFirstInCluster = indexInCluster === 0;
                
                // For overall streaming cursor logic
                const isAbsoluteLast =
                  clusterIndex === clusters.length - 1 && isLastInCluster;
                const showCursor =
                  isAbsoluteLast && conversation.role === "assistant" && isStreaming;

                return (
                  <div key={conversation.id} className="text-sm md:text-base">
                    <MessageBubble
                      conversation={conversation}
                      isStreaming={showCursor}
                      groupedWithPrevious={!isFirstInCluster}
                      groupedWithNext={!isLastInCluster}
                      aiMessageBackground={aiMessageBackground}
                      humanMessageBackground={humanMessageBackground}
                      showActions={
                        conversation.role === "assistant" && isLastInCluster
                      }
                    />
                  </div>
                );
              })}
            </div>
          ));
        })()}

      {assistantTyping && <DynamicAssistantTyping />}

      {showScrollButton && (
        <div className="sticky bottom-3 z-199 w-full flex justify-center items-center pointer-events-none">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              userScrolledUpRef.current = false;
              jumpToBottom();
            }}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 cursor-pointer rounded-full border shadow-[0_4px_16px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.24)] hover:scale-105 transition-all duration-200"
            style={{
              backgroundColor: config.branding.surfaceColor,
              borderColor: config.branding.borderColor,
              color: config.branding.primaryTextColor,
              borderRadius: "9999px",
            }}
            aria-label="Scroll to bottom"
          >
            <ChevronsDown size={18} className="shrink-0" />
          </Button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
