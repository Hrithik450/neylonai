"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { guminertBold } from "@/assets/fonts";
import { useTypingAnimation } from "@/hooks/use-animation-hook";

import { useSessionStore } from "@/store/session-store";
import {
  useWidgetToggleStore,
  useWidgetNavigationStore,
} from "@/store/widget-store";

const texts = [
  "How can I help you today?",
  "Need information about our services or pricing?",
  "I'm here to answer your questions instantly.",
  "Looking for a solution? Let's find the right one together.",
  "Ask me anything about our products and services.",
];

export function WidgetIntroText() {
  const { isOpen } = useWidgetToggleStore();
  const { activeTab } = useWidgetNavigationStore();

  const { user, isAuthenticated } = useSessionStore();
  const { introText, displayText, startAnimation } = useTypingAnimation(
    texts,
    `Hi ${!isAuthenticated ? "there" : user && user.name.split(" ")[0]}👋`,
  );

  React.useEffect(() => {
    startAnimation();
  }, [isOpen, activeTab, startAnimation]);

  return (
    <div className={cn("mt-8 px-1 text-[#0E3228]", guminertBold.className)}>
      <h2 className="text-2xl font-bold mb-1">
        <span className="fade-in">{introText}</span>
      </h2>
      <p className="text-lg font-normal fade-in h-6 text-black/70">
        <span className="fade-in">{displayText}</span>
      </p>
    </div>
  );
}
