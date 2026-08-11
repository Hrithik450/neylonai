"use client";

import React from "react";
import { cn } from "../../ui";

export const NEYLONAI_MARKETING_URL = "https://neylonai.mhrithik.com";

/** Platform credit — always links to Neylon AI, not the customer brand. */
export function WidgetPoweredBy({ className }: { className?: string }) {
  return (
    <div className={cn("shrink-0 flex justify-center px-3 py-1.5", className)}>
      <a
        href={NEYLONAI_MARKETING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] leading-none text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        Powered by <span className="font-medium text-zinc-500">Neylon AI</span>
      </a>
    </div>
  );
}
