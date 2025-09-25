"use client";

import React from "react";
import { WidgetHeader } from "@/components/support-widget/widget-header";
import { ChevronRight, HelpCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { guminertRegular } from "@/assets/fonts";

/**
 * Props for the AskQuestionButton component.
 * @interface MessagePreviewProps
 * @property {string | null} [avatar_url] - Optional avatar URL
 * @property {string} sender_name - Name of the sender
 * @property {string} thread_title - Thread title
 * @property {string} timestamp - Message timestamp
 * @property {() => void} [action] - Optional click handler
 */
interface MessagePreviewProps {
  avatar_url?: string | null;
  sender_name: string;
  thread_title: string;
  timestamp: string;
  action?: () => void;
}

/**
 * Props for the AskQuestionButton component.
 * @interface AskQuestionButtonProps
 * @property {() => void} [onClick] - Optional click handler for the button.
 * @property {string} [className]
 */
interface AskQuestionButtonProps {
  onClick?: () => void;
  className?: string;
}

/**
 * A component to display a preview of a message thread.
 *
 * @component
 * @param {MessagePreviewProps} props - The MessagePreviewProps.
 * @returns {JSX.Element} The MessagePreview component.
 */
export const MessagePreview: React.FC<MessagePreviewProps> = ({
  avatar_url,
  thread_title,
  sender_name,
  timestamp,
  action,
}): React.JSX.Element => {
  return (
    <div
      onClick={action}
      className="group flex items-center p-3 max-w-sm mx-autoshadow-sm space-x-3 cursor-pointer hover:bg-violet-100/30 transition-colors border-b-2 border-black/10"
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatar_url ? (
          <Image
            className="h-12 w-12 rounded-full"
            src={avatar_url}
            alt={`${sender_name}'s avatar`}
            width={48}
            height={48}
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-white/60 border border-black/20 flex items-center justify-center text-center text-base font-semibold text-gray-700">
            {sender_name?.charAt(0).toUpperCase()}
          </div>
        )}
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
};

/**
 * A stylized button component for asking a question, styled using Tailwind CSS.
 *
 * @component
 * @param {AskQuestionButtonProps} props - The AskQuestionButtonProps.
 * @returns {JSX.Element} The AskQuestionButton component.
 */
export const AskQuestionButton: React.FC<AskQuestionButtonProps> = ({
  onClick,
  className,
}): React.JSX.Element => {
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
};

/**
 * WidgetAssistant component – displays a messages widget with a sticky header,
 * scrollable messages, and a bottom ask-question button.
 *
 * @component
 * @returns {JSX.Element} The WidgetAssistant component.
 */
export function WidgetAssistant(): React.JSX.Element {
  return (
    <section className="relative max-h-[100%] overflow-y-auto scrollbar-hide">
      {/* Sticky header at the top */}
      <WidgetHeader className="sticky top-0" header="Messages" />

      {/* Scrollable message previews */}
      <div className="flex flex-col">
        {[...Array(12)].map((_, idx) => (
          <MessagePreview
            key={idx}
            sender_name="Larry"
            thread_title="Hello! I'm Larry from Fat Llama. How can I ..."
            timestamp="4w ago"
            action={() => {}}
          />
        ))}
      </div>

      {/* Sticky bottom ask question button */}
      <div className="sticky bottom-4 flex justify-center z-20">
        <AskQuestionButton className="w-[max-content]" />
      </div>
    </section>
  );
}
