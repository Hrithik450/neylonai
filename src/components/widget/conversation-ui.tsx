"use client";

import React from "react";
import { cn } from "@/lib/utils";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";
import { ChevronsDown, Copy } from "lucide-react";
import { useWidgetStore } from "@/store/widget-store";

import { ThreadMessage } from "@/lib/types/types";
import { DynamicAssistantTyping } from "@/components/widget/assistant-typing";

export function ConversationUI({
  conversations,
}: {
  conversations?: ThreadMessage[];
}) {
  const { assistantTyping } = useWidgetStore();

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
  }, [conversations, assistantTyping, userScrolledUp]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative flex-1 w-full mx-auto overflow-y-auto scrollbar-hide px-0.5 pr-1 pt-2 md:pt-4"
    >
      {conversations &&
        conversations.length > 0 &&
        conversations.map((conversation, index) => (
          <div
            key={index}
            className={cn(
              "text-sm md:text-base rounded-xl",
              conversation.role === "user"
                ? "ml-auto max-w-[75%]"
                : "p-3 md:p-4 max-w-full",
            )}
          >
            {conversation.role === "assistant" ? (
              <div className="flex flex-col">
                <div className="prose max-w-none text-sm md:text-base">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      h1({ ...props }) {
                        return (
                          <h1
                            className="text-2xl md:text-3xl font-bold mb-4 mt-5"
                            {...props}
                          />
                        );
                      },
                      h2({ ...props }) {
                        return (
                          <h2
                            className="text-xl md:text-2xl font-semibold mb-3 mt-4"
                            {...props}
                          />
                        );
                      },
                      h3({ ...props }) {
                        return (
                          <h3
                            className="text-lg md:text-xl font-medium mb-2 mt-3"
                            {...props}
                          />
                        );
                      },
                      h4({ ...props }) {
                        return (
                          <h4
                            className="text-base md:text-lg font-medium mb-2 mt-2"
                            {...props}
                          />
                        );
                      },
                      h5({ ...props }) {
                        return (
                          <h5
                            className="text-sm md:text-base font-medium mb-1 mt-1"
                            {...props}
                          />
                        );
                      },
                      h6({ ...props }) {
                        return (
                          <h6
                            className="text-xs md:text-sm font-medium mb-1 mt-1"
                            {...props}
                          />
                        );
                      },
                      li({ ...props }) {
                        return (
                          <li className="ml-4 mb-1 list-disc" {...props} />
                        );
                      },
                      p({ ...props }) {
                        return (
                          <p className="mb-2 leading-relaxed" {...props} />
                        );
                      },
                      a({ ...props }) {
                        return (
                          <a
                            className="text-blue-500 hover:underline"
                            {...props}
                          />
                        );
                      },
                    }}
                  >
                    {conversation.content}
                  </ReactMarkdown>
                </div>

                {/* {conversation.file_url && (
                  <div className="max-w-max mr-auto flex items-center gap-3 p-2 bg-white/40 border border-black/20 rounded-xl transition-all duration-200">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-800 truncate max-w-max">
                        updated_resume.pdf
                      </span>
                      <span className="text-xs text-zinc-500">
                        PDF Document
                      </span>
                    </div>

                    <a
                      href={conversation.file_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-sm font-medium text-blue-500 hover:underline"
                    >
                      View
                    </a>
                  </div>
                )} */}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {/* {conversation.file_url && (
                  <div className="ml-auto flex items-center gap-3 p-1 pr-2 bg-white/40 border border-black/30 rounded-xl transition-all duration-200">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm text-black">PDF Document</span>
                    </div>

                    <a
                      href={conversation.file_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-sm font-medium text-blue-500 hover:underline"
                    >
                      View
                    </a>
                  </div>
                )} */}

                <p className="py-3 px-4 bg-zinc-200/90 border border-black/50 text-sm md:text-base leading-relaxed rounded-xl">
                  {conversation.content}
                </p>
              </div>
            )}

            {conversation.role === "assistant" && (
              <div className={cn("flex justify-start space-x-2")}>
                <button
                  onClick={() => copyToClipboard(conversation.content)}
                  className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  title="Copy"
                >
                  <Copy size={18} />
                </button>
              </div>
            )}
          </div>
        ))}

      {assistantTyping && <DynamicAssistantTyping />}

      {showScrollButton && (
        <div className="sticky bottom-3 z-199 w-full flex justify-center items-center px-2 pr-3">
          <button
            onClick={() => scrollToBottom(true)}
            className="p-1 w-fit cursor-pointer rounded-full border border-black/50 bg-gray-200 shadow-md hover:bg-gray-300 transition"
          >
            <ChevronsDown size={22} />
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
