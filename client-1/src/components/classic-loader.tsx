import { cn } from "@/lib/utils";
import React from "react";

export function ClassicLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center font-sans", className)}>
      <div className="w-10 h-10 border-[3px] border-gray-300 border-t-black rounded-full animate-spin" />
    </div>
  );
}
