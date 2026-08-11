"use client";

/**
 * Support widget shell.
 *
 * Flow: SupportWidget (toggle) → Widget (this file) → TabsRegistry → per-tab screen stack.
 */
import React, { useEffect, useMemo } from "react";
import { cn } from "../../ui";
import { House, MessageSquareText, Mail } from "lucide-react";

import { WidgetScreens, WidgetTabs } from "../constants";
import type { WidgetScreenType, WidgetTabType } from "../constants";
import { useWidgetHost } from "../context/widget-host";
import { useWidgetFont } from "../hooks/use-widget-font";

import { WidgetHome } from "./widget-tabs/widget-home";
import { WidgetThreads } from "./widget-tabs/widget-threads";
import { WidgetMessages } from "./widget-screens/widget-messages";
import { WidgetContact } from "./widget-tabs/widget-contact";
import { WidgetPoweredBy } from "./widget-powered-by";

import {
  useWidgetToggleStore,
  useWidgetNavigationStore,
} from "../store/widget-store";

const TabsRegistry = {
  Home: {
    icon: <House className="w-5 h-5" strokeWidth={2} />,
    label: "Home",
    screens: {
      [WidgetScreens.HomeScreens.Home]: WidgetHome,
    },
    default: WidgetScreens.HomeScreens.Home,
  },
  Messages: {
    icon: <MessageSquareText className="w-5 h-5" strokeWidth={2} />,
    label: "Chats",
    screens: {
      [WidgetScreens.MessagesScreens.Threads]: WidgetThreads,
      [WidgetScreens.MessagesScreens.Messages]: WidgetMessages,
    },
    default: WidgetScreens.MessagesScreens.Threads,
  },
  Contact: {
    icon: <Mail className="w-5 h-5" strokeWidth={2} />,
    label: "Contact",
    screens: {
      [WidgetScreens.ContactScreens.Contact]: WidgetContact,
    },
    default: WidgetScreens.ContactScreens.Contact,
  },
} as const;

function getScreenComponent(tab: WidgetTabType, screenName: WidgetScreenType) {
  return (
    TabsRegistry[tab].screens as Record<string, React.ComponentType<any>>
  )[screenName];
}

const LAUNCHER_SIZE_PX = {
  sm: 48,
  md: 56,
  lg: 64,
} as const;

/** Space between open panel and launcher bubble. */
const PANEL_LAUNCHER_GAP_PX = 12;

function widgetPanelClassName(
  isOpen: boolean,
  isCollapse: boolean,
  fontClassName: string | undefined,
  inline: boolean,
  isLeft: boolean,
) {
  return cn(
    fontClassName,
    inline
      ? cn(
          // Sit inside the preview frame; bottom clearance comes from inline style
          // so the launcher stays visible below the panel.
          "absolute left-1.5 right-1.5 top-2 z-10 overflow-hidden origin-bottom",
          "w-auto min-w-0 max-w-full",
        )
      : cn(
          "fixed max-md:inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          "md:bottom-[var(--neylonai-panel-bottom,5rem)]",
          isLeft ? "md:left-5 md:right-auto" : "md:right-5",
          "2xl:right-[max(1.2rem,calc((100vw-120rem)/2+2rem))]",
          isLeft &&
            "2xl:left-[max(1.2rem,calc((100vw-120rem)/2+2rem))] 2xl:right-auto",
          "origin-bottom-right",
          isLeft && "origin-bottom-left",
          "md:h-[65vh] lg:h-[85vh] max-h-full md:max-h-187.5 z-99",
          isCollapse
            ? "w-full md:min-w-md md:max-w-md"
            : "w-full md:min-w-2xl md:max-w-2xl",
        ),
    "border border-gray-400/40 shadow-2xl sm:rounded-2xl pt-2 sm:pt-3 flex flex-col",
    "overscroll-contain",
    "transition-[opacity,transform,min-width,max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    isOpen
      ? "opacity-100 translate-y-0 pointer-events-auto"
      : "opacity-0 translate-y-2 pointer-events-none",
  );
}

export function Widget() {
  const { isOpen, isCollapse } = useWidgetToggleStore();
  const { activeTab, tabStacks, switchTab } = useWidgetNavigationStore();
  const { config } = useWidgetHost();

  const inline = config.presentation === "inline";
  const isLeft = config.layout.position === "bottom-left";
  const tabActiveColor = config.branding.tabActiveColor;
  const tabAccentColor = config.branding.accentColor;
  const gradientFrom = config.branding.gradientFrom;
  const gradientTo = config.branding.gradientTo;
  const launcherPx = LAUNCHER_SIZE_PX[config.layout.launcherSize];
  const { fontFamily } = useWidgetFont(config.branding.font);
  // Keep the open panel clear of the launcher + a small premium gap (desktop / inline).
  const panelBottomPx =
    (inline ? 0 : config.layout.offsetY) + launcherPx + PANEL_LAUNCHER_GAP_PX;

  const enabledTabs = useMemo(() => {
    const tabs: WidgetTabType[] = [];
    if (config.features.homeTab) tabs.push(WidgetTabs.Home);
    if (config.features.messagesTab) tabs.push(WidgetTabs.Messages);
    if (config.features.contactTab) tabs.push(WidgetTabs.Contact);
    return tabs.length > 0 ? tabs : [WidgetTabs.Home];
  }, [
    config.features.homeTab,
    config.features.messagesTab,
    config.features.contactTab,
  ]);

  useEffect(() => {
    // Contact can be opened from Home ("Talk to the team") even when the
    // Contact tab is hidden in the bottom bar.
    if (
      !enabledTabs.includes(activeTab) &&
      activeTab !== WidgetTabs.Contact
    ) {
      switchTab(enabledTabs[0]!);
    }
  }, [activeTab, enabledTabs, switchTab]);

  const isRootScreen = tabStacks[activeTab]?.stack.length === 1;
  const currentScreen = tabStacks[activeTab]?.stack.at(-1);
  const ActiveScreen = currentScreen
    ? getScreenComponent(activeTab, currentScreen.name)
    : null;

  const showTabBar = isRootScreen && enabledTabs.length > 1;

  return (
    <div
      data-neylonai-widget
      className={cn(
        widgetPanelClassName(
          isOpen,
          isCollapse,
          config.branding.fontClassName,
          inline,
          isLeft,
        ),
        // Keep bottom flush with chrome (tab bar / composer), same as home nav.
        !showTabBar && "pb-1.5",
      )}
      style={{
        fontFamily,
        // Use longhands so nothing else can clobber the panel gradient.
        backgroundImage: `linear-gradient(to bottom, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        backgroundColor: gradientTo,
        // Mobile fullscreen uses inset-0; md+ / inline use this clearance.
        ...(inline
          ? { bottom: panelBottomPx }
          : ({
              ["--neylonai-panel-bottom" as string]: `${panelBottomPx}px`,
            } as React.CSSProperties)),
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
        {ActiveScreen && <ActiveScreen {...currentScreen?.props} />}
      </div>

      {isRootScreen ? <WidgetPoweredBy /> : null}

      {showTabBar ? (
        <nav className="border-t flex justify-around px-1">
          {enabledTabs.map((tab) => {
            const configTab = TabsRegistry[tab];
            const selected = tab === activeTab;
            return (
              <button
                key={configTab.label}
                type="button"
                onClick={() => switchTab(tab)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 cursor-pointer rounded-none",
                  "bg-transparent border-0 outline-none",
                  "hover:bg-black/[0.03] transition-colors",
                )}
                style={{
                  color: selected ? tabActiveColor : tabAccentColor,
                }}
              >
                {configTab.icon}
                <span className="text-[11px] font-medium leading-none">
                  {configTab.label}
                </span>
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
