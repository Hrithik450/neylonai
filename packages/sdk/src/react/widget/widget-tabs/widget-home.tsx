"use client";

import { ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import React from "react";

import { cn } from "../../../ui";
import { Button } from "../../../ui";

import { contrastForeground } from "../../color-contrast";
import { WidgetScreens, WidgetTabs } from "../../constants";
import { WidgetIntroText } from "../widget-intro-texts";
import { WidgetChromeActions } from "../widget-header";
import { WidgetFaqs } from "../widget-faqs";
import { useWidgetNavigation } from "../../hooks/use-widget-navigation";
import { useWidgetHost } from "../../context/widget-host";
import { useThreadStore } from "../../store/thread-store";
import { useWidgetFont } from "../../hooks/use-widget-font";

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="7.5" r="2.25" />
      <path d="M8.5 16.5c0-2.1 1.6-3.5 3.5-3.5s3.5 1.4 3.5 3.5" />
      <circle cx="5.5" cy="9" r="2" />
      <path d="M2.5 17c0-1.8 1.3-3 3-3 0.7 0 1.3 0.2 1.8 0.6" />
      <circle cx="18.5" cy="9" r="2" />
      <path d="M16.7 14.6c0.5-0.4 1.1-0.6 1.8-0.6 1.7 0 3 1.2 3 3" />
    </svg>
  );
}

function pageLabelFromPath(pagePath: string | null | undefined): string | null {
  if (!pagePath || pagePath === "/") return null;
  const segment = pagePath
    .split("?")[0]
    ?.split("#")[0]
    ?.split("/")
    .filter(Boolean)
    .at(-1);
  if (!segment) return null;
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WidgetHome() {
  const { navigate } = useWidgetNavigation();
  const { config } = useWidgetHost();
  const { setCurrentThreadId } = useThreadStore();
  const branding = config.branding;
  const headingClass = branding.headingClassName;
  const pageLabel = pageLabelFromPath(config.pagePath);
  const { fontFamily } = useWidgetFont(branding.font);

  const openChat = React.useCallback(() => {
    setCurrentThreadId(null);
    navigate(WidgetTabs.Messages, WidgetScreens.MessagesScreens.Messages);
  }, [navigate, setCurrentThreadId]);

  const requestHuman = React.useCallback(() => {
    navigate(WidgetTabs.Contact, WidgetScreens.ContactScreens.Contact);
  }, [navigate]);

  return (
    <section
      className="h-full min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 lg:px-3"
      style={{ fontFamily }}
    >
      <div
        className="py-2 pb-1 px-2 max-md:rounded-none rounded-b-2xl"
        style={{ color: branding.primaryTextColor }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 min-w-0">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.name?.trim() || "Logo"}
                className="h-11 w-auto max-w-[12rem] object-contain object-left shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={{
                  backgroundColor: branding.primaryTextColor,
                  color: contrastForeground(branding.primaryTextColor),
                }}
              >
                {(branding.name?.trim() || "?").slice(0, 1)}
              </div>
            )}
            {branding.name?.trim() ? (
              <h3
                className={cn(headingClass, "text-xl truncate")}
                style={{
                  color: branding.primaryTextColor,
                  fontFamily,
                }}
              >
                {branding.name.trim()}
              </h3>
            ) : null}
          </div>

          <WidgetChromeActions />
        </div>

        <WidgetIntroText />

        <p
          className="mt-4.5 px-1 text-[13px] flex items-center gap-1.5"
          style={{ color: branding.secondaryTextColor }}
        >
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden />
          <span>
            {branding.name?.trim()
              ? `Answers from ${branding.name.trim()}'s knowledge`
              : "Answers from your knowledge"}
            {pageLabel ? `. Help for ${pageLabel}` : ""}
          </span>
        </p>
      </div>

      <div className="pb-5 px-2 space-y-4">
        <Button
          type="button"
          variant="ghost"
          onClick={openChat}
          className="group h-auto w-full cursor-pointer rounded-xl px-4 pr-5 py-4 flex justify-between items-center gap-3 shadow-sm border hover:opacity-95 hover:bg-transparent"
          style={{
            backgroundColor: branding.primaryTextBackground,
            color: branding.askButtonTextColor,
            borderColor: branding.askButtonTextColor,
          }}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3.5">
            <span 
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${branding.askButtonTextColor} 10%, transparent)` }}
            >
              <MessageCircle className="w-5 h-5" />
            </span>
            <span className="flex min-w-0 flex-col items-start text-left">
              <span className="font-semibold text-sm md:text-base">
                {config.messages.askTitle}
              </span>
              <span
                className="text-sm font-normal whitespace-normal break-words opacity-80"
              >
                {config.messages.askSubtitle.replace(/\s*[—–]\s*|\s+-\s+/g, ", ")}
              </span>
            </span>
          </span>
          <ArrowRight className="w-5 h-5 shrink-0 opacity-80 group-hover:-rotate-45 transition-transform duration-150 ease-in-out" />
        </Button>

        <WidgetFaqs />

        <Button
          type="button"
          variant="outline"
          onClick={requestHuman}
          className="group h-auto w-full cursor-pointer shadow-none border rounded-xl px-4 pr-5 py-3.5 flex justify-between items-center gap-3"
          style={{
            backgroundColor: branding.secondaryTextBackground,
            borderColor: branding.borderColor,
          }}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: branding.primaryTextBackground,
                color: branding.askButtonTextColor,
              }}
            >
              <TeamIcon className="w-7 h-7" />
            </span>
            <span className="flex min-w-0 flex-col items-start text-left">
              <span
                className="font-semibold text-sm"
                style={{ color: branding.primaryTextColor }}
              >
                {config.messages.feedbackTitle}
              </span>
              <span
                className="text-xs font-normal whitespace-normal break-words"
                style={{ color: branding.secondaryTextColor }}
              >
                {config.messages.feedbackSubtitle}
              </span>
            </span>
          </span>
          <ArrowRight
            className="w-4 h-4 shrink-0 group-hover:-rotate-45 transition-transform duration-150 ease-in-out"
            style={{ color: branding.secondaryTextColor }}
          />
        </Button>
      </div>
    </section>
  );
}
