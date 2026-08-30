"use client";

import React from "react";
import { cn } from "../../ui";
import { useTypingAnimation } from "../hooks/use-animation-hook";
import { useWidgetHost } from "../context/widget-host";
import { useWidgetFont } from "../hooks/use-widget-font";
import {
  useWidgetToggleStore,
  useWidgetNavigationStore,
} from "../store/widget-store";

export function WidgetIntroText() {
  const { isOpen } = useWidgetToggleStore();
  const { activeTab } = useWidgetNavigationStore();
  const { user, isAuthenticated, config } = useWidgetHost();
  const { fontFamily } = useWidgetFont(config.branding.font);
  const firstName = user?.name?.split(" ")[0];
  const name = !isAuthenticated ? "there" : (firstName ?? "there");
  const rawGreeting = (
    config.messages.welcomeGreeting || "Hi {name} 👋"
  ).replace("{name}", name);

  const greeting = /\p{Extended_Pictographic}/u.test(rawGreeting)
    ? rawGreeting.replace(/(\S)(\p{Extended_Pictographic})/gu, "$1 $2")
    : `${rawGreeting.trimEnd()} 👋`;

  const introLines = React.useMemo(
    () =>
      config.messages.introMessages.map((line) =>
        line.replace(/\s*[—–]\s*|\s+-\s+/g, ", "),
      ),
    [config.messages.introMessages],
  );

  const { introText, displayText, startAnimation } = useTypingAnimation(
    introLines,
    greeting,
  );

  React.useEffect(() => {
    if (!isOpen) return;
    startAnimation();
  }, [isOpen, activeTab, startAnimation]);

  return (
    <div
      className={cn("mt-12 sm:mt-14 px-1", config.branding.headingClassName)}
      style={{ color: config.branding.primaryTextColor, fontFamily }}
    >
      <h2
        className="text-2xl sm:text-[1.65rem] font-bold mb-0 leading-tight min-h-[1.2em] break-words"
        style={{ fontFamily }}
      >
        <span>{introText}</span>
      </h2>
      <p
        className="pt-1 sm:pt-1.5 pb-4 sm:pb-5 text-base sm:text-lg font-normal leading-relaxed min-h-[2.5em] break-words line-clamp-2"
        style={{
          color: config.branding.secondaryTextColor,
          fontFamily,
        }}
      >
        <span>{displayText}</span>
      </p>
    </div>
  );
}
