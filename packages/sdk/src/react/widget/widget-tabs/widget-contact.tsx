"use client";

import React from "react";
import { WidgetHeader } from "../widget-header";
import { useWidgetHost } from "../../context/widget-host";
import { useWidgetNavigation } from "../../hooks/use-widget-navigation";
import { WidgetScreens, WidgetTabs } from "../../constants";

export function WidgetContact() {
  const { config } = useWidgetHost();
  const { navigate } = useWidgetNavigation();
  const branding = config.branding;
  const secondary = branding.secondaryTextColor;

  return (
    <div className="flex flex-col h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <WidgetHeader
        className="sticky top-0"
        header={config.messages.feedbackTitle || "Talk to the team"}
        action={() =>
          navigate(WidgetTabs.Home, WidgetScreens.HomeScreens.Home)
        }
      />

      <div className="flex flex-col px-4 sm:px-5 py-4 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-sm" style={{ color: secondary }}>
            {branding.name?.trim()
              ? `Reach ${branding.name.trim()} directly. A person will follow up with context from your visit.`
              : "Reach the team directly. A person will follow up with context from your visit."}
          </p>
        </div>

        <div className="rounded-xl border border-black/10 bg-white px-4 py-3.5 text-sm text-zinc-600">
          Ask a question from Home and we&apos;ll escalate to a person when
          needed.
        </div>
      </div>
    </div>
  );
}
