"use client";

import React from "react";
import { cn } from "../../ui";
import { useWidgetHost } from "../context/widget-host";

export const NEYLONAI_MARKETING_URL = "https://neylonai.mhrithik.com";

/** Platform credit — always links to Neylon AI, not the customer brand. */
export function WidgetPoweredBy({ className }: { className?: string }) {
  const { config } = useWidgetHost();
  const muted = config.branding.secondaryTextColor;
  return (
    <div className={cn("shrink-0 flex justify-center px-3 py-1.5", className)}>
      <a
        href={NEYLONAI_MARKETING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] leading-none transition-opacity hover:opacity-80"
        style={{ color: muted }}
      >
        Powered by <span className="font-medium">Neylon AI</span>
      </a>
    </div>
  );
}
