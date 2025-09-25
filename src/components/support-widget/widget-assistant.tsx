import React from "react";
import WidgetHeader from "@/components/support-widget/widget-header";
import { ChevronRight } from "lucide-react";
import Image from "next/image";

interface MessagePreviewProps {
  avatar_url?: string;
  sender_name: string;
  thread_title: string;
  timestamp: string;
  action?: () => void; // Optional click handler
}

/**
 * A component to display a preview of a message thread.
 */
export const MessagePreview: React.FC<MessagePreviewProps> = ({
  avatar_url,
  thread_title,
  sender_name,
  timestamp,
  action,
}) => {
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
      <ChevronRight className="w-5 h-5 group-hover:-rotate-90 transition-transform duration-300 ease-in-out" />
    </div>
  );
};

export function WidgetAssistant() {
  return (
    <section className="relative max-h-[100%] overflow-y-auto scrollbar-hide">
      <WidgetHeader className="sticky top-0" header="Messages" />

      {[...Array(12)].map((thread, idx) => (
        <MessagePreview
          key={idx}
          sender_name="Larry"
          thread_title="Hello! I'm Larry from Fat Llama. How can I ..."
          timestamp="4w ago"
          action={() => {}}
        />
      ))}
    </section>
  );
}
