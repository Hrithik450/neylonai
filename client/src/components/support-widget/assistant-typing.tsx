import React from "react";
import { Brain } from "lucide-react";
import { messageSets } from "@/lib/constants";

export function DynamicAssistantTyping({
  isAssistantTyping,
  depth = 1,
  speed = 3000,
}: {
  isAssistantTyping: boolean;
  depth?: number;
  speed?: number;
}) {
  const [msgIndex, setMsgIndex] = React.useState<number>(0);

  const level = Math.min(Math.max(depth, 1), 4) as keyof typeof messageSets;
  const baseMessages = messageSets[level];

  React.useEffect(() => {
    if (isAssistantTyping) setMsgIndex(0);
  }, [isAssistantTyping]);

  React.useEffect(() => {
    if (!isAssistantTyping) return;

    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % baseMessages.length);
    }, speed);
    return () => clearInterval(timer);
  }, [isAssistantTyping, baseMessages, speed]);

  if (!isAssistantTyping) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 md:mb-4 p-3 md:p-4 rounded-lg mr-auto w-full"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-10 h-10">
          <div className="absolute rounded-full ">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            </div>
          </div>

          <div className="relative z-10 p-2 bg-white rounded-full flex items-center justify-center">
            <Brain className="w-5 h-5 text-gray-700" />
          </div>
        </div>

        <div className="flex-1">
          <span className="text-sm md:text-base text-gray-800 font-medium">
            {baseMessages[msgIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}
