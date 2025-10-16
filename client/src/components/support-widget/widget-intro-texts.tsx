"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import { guminertBold } from "@/assets/fonts";
import { useTypingAnimation } from "@/hooks/use-animation-hook";
import { useSupportWidgetToggleStore } from "@/store/store";

const texts = [
  "How can I assist you today?",
  "I am your AI assistant from AI Solutionz.",
  "We build smart and scalable AI solutions for your business.",
  "From chatbots to automation, we make AI simple.",
  "Your growth partner in intelligent automation.",
];

export function WidgetIntroText({ session }: { session?: Session | null }) {
  const { isOpen } = useSupportWidgetToggleStore();
  const { introText, displayText, startAnimation } = useTypingAnimation(
    texts,
    `Hi ${
      !session || !session.user || !session?.user?.name
        ? "there"
        : session.user.name.split(" ")[0]
    }👋`
  );

  React.useEffect(() => {
    if (isOpen) startAnimation();
  }, [isOpen]);

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
