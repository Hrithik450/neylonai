"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { SupportWidget } from "@/components/support-widget";

export function AIChat() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative flex items-center justify-center">
      <div className="fixed bottom-5 right-3 sm:right-6 z-50 flex flex-col items-end">
        <SupportWidget isOpen={isOpen} setIsOpen={setIsOpen} />

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-[#0E3228] border border-white/80 cursor-pointer w-15 h-15 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <div
            className={cn(
              isOpen ? "rotate-90" : "rotate-0",
              "transform transition-transform duration-200 "
            )}
          >
            {isOpen ? (
              <ChevronRight className="w-6 h-6 text-white" />
            ) : (
              <MessagesSquare className="w-6 h-6 text-white" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
