"use client";

import React from "react";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";
import { useAssistantStore } from "@/store/store";
import { ChevronsDown, Copy, Volume2 } from "lucide-react";
import { ClassicLoader } from "@/components/classic-loader";
import { NewMessage } from "@/actions/thread_messages/thread_messages.types";

export function ConversationUI({
  conversations,
}: {
  conversations?: NewMessage[];
}) {
  const [loadingIndex, setLoadingIndex] = React.useState<number | null>(null);
  const { isAssistantTyping } = useAssistantStore();

  // Auto Scroll to bottom on new message
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [userScrolledUp, setUserScrolledUp] = React.useState(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;

    setShowScrollButton(!isAtBottom);
    setUserScrolledUp(!isAtBottom);
  };

  const scrollToBottom = (smooth: boolean = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setUserScrolledUp(false);
  };

  React.useEffect(() => {
    if (!userScrolledUp) scrollToBottom(true);
  }, [conversations, isAssistantTyping]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const speak = async (text: string, index?: number) => {
    try {
      if (index) setLoadingIndex(index);
      const res = await fetch("/api/model/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("Failed to get audio");
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error("Speak error:", error);
    } finally {
      if (index) setLoadingIndex(null);
    }
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative flex-1 w-full mx-auto overflow-y-auto scrollbar-hide pt-2 px-2 md:pt-4"
    >
      {conversations &&
        conversations.length > 0 &&
        conversations.map((conversation, index) => (
          <div
            key={index}
            className={`mb-3 md:mb-4 p-3 md:p-4 text-sm md:text-base rounded-xl ${
              conversation.role === "user"
                ? "bg-zinc-200/90 ml-auto max-w-[80%] border border-black/40"
                : "max-w-[90%] md:max-w-[100%]"
            }`}
          >
            {conversation.role === "assistant" ? (
              <div className="prose max-w-none text-sm md:text-base">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    h1({ ...props }) {
                      return (
                        <h1
                          className="text-2xl md:text-3xl font-bold mb-4 mt-6"
                          {...props}
                        />
                      );
                    },
                    h2({ ...props }) {
                      return (
                        <h2
                          className="text-xl md:text-2xl font-semibold mb-3 mt-5"
                          {...props}
                        />
                      );
                    },
                    h3({ ...props }) {
                      return (
                        <h3
                          className="text-lg md:text-xl font-medium mb-2 mt-4"
                          {...props}
                        />
                      );
                    },
                    h4({ ...props }) {
                      return (
                        <h4
                          className="text-base md:text-lg font-medium mb-2 mt-3"
                          {...props}
                        />
                      );
                    },
                    h5({ ...props }) {
                      return (
                        <h5
                          className="text-sm md:text-base font-medium mb-1 mt-2"
                          {...props}
                        />
                      );
                    },
                    h6({ ...props }) {
                      return (
                        <h6
                          className="text-xs md:text-sm font-medium mb-1 mt-2"
                          {...props}
                        />
                      );
                    },
                    li({ ...props }) {
                      return <li className="ml-4 mb-1 list-disc" {...props} />;
                    },
                    p({ ...props }) {
                      return <p className="mb-2 leading-relaxed" {...props} />;
                    },
                    a({ ...props }) {
                      return (
                        <a
                          className="text-blue-600 hover:underline"
                          {...props}
                        />
                      );
                    },
                  }}
                >
                  {conversation.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p>{conversation.content}</p>
            )}

            {conversation.role === "assistant" && (
              <div className="flex justify-start mt-3 space-x-2">
                <button
                  onClick={() => copyToClipboard(conversation.content)}
                  className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  title="Copy"
                >
                  <Copy size={18} />
                </button>

                <button
                  onClick={() => speak(conversation.content, index)}
                  className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  title="Speak"
                >
                  {loadingIndex === index ? (
                    <ClassicLoader />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </button>
              </div>
            )}
          </div>
        ))}

      {isAssistantTyping && (
        <div className="mb-3 md:mb-4 p-3 md:p-4 rounded-lg bg-gray-100 mr-auto max-w-[90%] md:max-w-[80%]">
          <div className="flex items-center gap-2">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
            </div>

            <span className="text-sm md:text-base">
              Analyzing your sentence...
            </span>
          </div>
        </div>
      )}

      {showScrollButton && (
        <div className="sticky bottom-1 w-full flex justify-end items-center px-2">
          <button
            onClick={() => scrollToBottom(true)}
            className="p-1 w-fit cursor-pointer rounded-full border border-black/50 bg-gray-200 shadow-md hover:bg-gray-300 transition"
          >
            <ChevronsDown size={20} />
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
