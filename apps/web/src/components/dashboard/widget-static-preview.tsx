"use client";

import { useEffect, useMemo } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  Widget,
  WidgetHostProvider,
  useWidgetHost,
  useWidgetToggleStore,
} from "@neylonai/sdk/react";
import {
  mergeWidgetConfig,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";
import {
  STATIC_DEMO_MESSAGES,
  STATIC_DEMO_THREADS,
} from "@/components/dashboard/widget-static-preview-data";

const LAUNCHER_SIZE_PX = {
  sm: 48,
  md: 56,
  lg: 64,
} as const;

/** Same launcher as SupportWidgetInner — draft colors, no proactive bubble. */
function PreviewLauncher() {
  const { config } = useWidgetHost();
  const { isOpen, setIsOpen } = useWidgetToggleStore();
  const layout = config.layout;
  const sizePx = LAUNCHER_SIZE_PX[layout.launcherSize];

  if (!layout.launcherVisible) return null;

  return (
    <div className="relative z-20 shrink-0">
      <button
        type="button"
        data-testid="ask-ai-launcher"
        aria-label={isOpen ? "Close AI chat" : "Ask AI"}
        onClick={() => setIsOpen(!isOpen)}
        className="border border-white/80 cursor-pointer rounded-full flex items-center justify-center p-0 transition-transform duration-200 hover:scale-105 active:scale-95 hover:opacity-90"
        style={{
          backgroundColor: config.branding.primaryTextBackground,
          color: config.branding.askButtonTextColor,
          width: sizePx,
          height: sizePx,
        }}
      >
        <span
          className={
            isOpen
              ? "rotate-90 transform transition-transform duration-200 flex items-center justify-center text-current"
              : "rotate-0 transform transition-transform duration-200 flex items-center justify-center text-current"
          }
        >
          {isOpen ? (
            <ChevronRight
              className="size-7"
              strokeWidth={2.25}
              stroke="currentColor"
            />
          ) : (
            <Sparkles
              className="size-7"
              strokeWidth={2.25}
              stroke="currentColor"
            />
          )}
        </span>
      </button>
    </div>
  );
}

/**
 * Dashboard appearance preview: real SDK Widget shell + launcher.
 * Only difference from embeds: draft config + staticDemo (no API key / live data).
 */
export function WidgetStaticPreview({
  appearance,
  open,
  onOpenChange,
}: {
  appearance: StoredWidgetConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const resolved = useMemo(() => {
    const base = mergeWidgetConfig(appearance);
    return {
      ...base,
      presentation: "inline" as const,
      pagePath: "/",
      proactive: {
        ...base.proactive,
        enabled: false,
      },
      staticDemo: {
        threads: STATIC_DEMO_THREADS,
        messages: STATIC_DEMO_MESSAGES,
      },
    };
  }, [appearance]);

  useEffect(() => {
    useWidgetToggleStore.getState().setIsOpen(open);
  }, [open]);

  useEffect(() => {
    return useWidgetToggleStore.subscribe((state) => {
      onOpenChange(state.isOpen);
    });
  }, [onOpenChange]);

  return (
    <WidgetHostProvider config={resolved}>
      <div className="relative z-10 flex flex-col items-end w-full h-full min-w-0 max-w-full overflow-hidden justify-end">
        <Widget />
        <PreviewLauncher />
      </div>
    </WidgetHostProvider>
  );
}
