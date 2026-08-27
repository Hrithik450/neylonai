"use client";

import React from "react";
import { cn } from "../../ui";
import { useWidgetHost } from "../context/widget-host";

interface WidgetLoaderProps {
  className?: string;
  /** Spinner accent (defaults to the theme's primary text color). */
  color?: string;
  label?: string;
}

/**
 * Stable panel loader — fixed footprint, no skeleton layout thrash.
 */
export function WidgetLoader({
  className,
  color,
  label = "Loading",
}: WidgetLoaderProps) {
  const { config } = useWidgetHost();
  const accent = color ?? config.branding.primaryTextColor;
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
        className="block size-7 rounded-full border-2 animate-spin"
        style={{
          borderColor: config.branding.borderColor,
          borderTopColor: accent,
        }}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
