"use client";

import React from "react";
import { cn } from "../../ui";

interface WidgetLoaderProps {
  className?: string;
  /** Spinner accent (defaults to near-black). */
  color?: string;
  label?: string;
}

/**
 * Stable panel loader — fixed footprint, no skeleton layout thrash.
 */
export function WidgetLoader({
  className,
  color = "#0E3228",
  label = "Loading",
}: WidgetLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex flex-1 w-full min-h-[12rem] items-center justify-center",
        className,
      )}
    >
      <span
        className="block size-7 rounded-full border-2 border-black/10 animate-spin"
        style={{ borderTopColor: color }}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
