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
    screens: { [WidgetScreens.HomeScreens.Home]: WidgetHome },
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
    screens: { [WidgetScreens.ContactScreens.Contact]: WidgetContact },
    default: WidgetScreens.ContactScreens.Contact,
  },
} as const;

const getScreenComponent = (tab: WidgetTabType, screenName: WidgetScreenType) =>
  (TabsRegistry[tab].screens as Record<string, React.ComponentType<any>>)[screenName];

const LAUNCHER_SIZE_PX = { sm: 48, md: 56, lg: 64 } as const;
const PANEL_LAUNCHER_GAP_PX = 12;

const widgetPanelClassName = (isOpen: boolean, isCollapse: boolean, fontClassName: string | undefined, inline: boolean, isLeft: boolean) =>
  cn(
    fontClassName,
    inline
      ? cn(
          "absolute left-1.5 right-1.5 top-2 z-10 overflow-hidden origin-bottom",
          "w-auto min-w-0 max-w-full",
          "rounded-2xl border border-gray-400/40 shadow-2xl",
        )
      : cn(
          "fixed z-[110] overflow-hidden overscroll-contain",
          "max-md:inset-0 max-md:h-dvh max-md:max-h-dvh max-md:w-full max-md:min-w-0 max-md:max-w-none",
          "max-md:rounded-none max-md:border-0 max-md:shadow-none",
          "max-md:pt-[max(0.5rem,env(safe-area-inset-top,0px))]",
          "md:bottom-[var(--neylonai-panel-bottom,5rem)]",
          isLeft ? "md:left-5 md:right-auto" : "md:right-5",
          "2xl:right-[max(1.2rem,calc((100vw-120rem)/2+2rem))]",
          isLeft && "2xl:left-[max(1.2rem,calc((100vw-120rem)/2+2rem))] 2xl:right-auto",
          "origin-bottom-right",
          isLeft && "origin-bottom-left",
          "md:h-[65vh] lg:h-[85vh] md:max-h-187.5",
          "md:rounded-2xl md:border md:border-gray-400/40 md:shadow-2xl",
          isCollapse ? "md:min-w-md md:max-w-md md:w-full" : "md:min-w-2xl md:max-w-2xl md:w-full",
        ),
    "md:pt-2 flex flex-col min-w-0",
    "transition-[opacity,transform,min-width,max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none",
  );

export function Widget() {
  const { isOpen, isCollapse } = useWidgetToggleStore();
  const { activeTab, tabStacks, switchTab } = useWidgetNavigationStore();
  const { config } = useWidgetHost();

  const inline = config.presentation === "inline";
  const isLeft = config.layout.position === "bottom-left";
  const { tabActiveColor, accentColor, gradientFrom, gradientTo } = config.branding;
  const launcherPx = LAUNCHER_SIZE_PX[config.layout.launcherSize];
  const { fontFamily } = useWidgetFont(config.branding.font);
  const panelBottomPx = (inline ? 0 : config.layout.offsetY) + launcherPx + PANEL_LAUNCHER_GAP_PX;

  const enabledTabs = useMemo(() => {
    const tabs: WidgetTabType[] = [];
    if (config.features.homeTab) tabs.push(WidgetTabs.Home);
    if (config.features.messagesTab) tabs.push(WidgetTabs.Messages);
    if (config.features.contactTab) tabs.push(WidgetTabs.Contact);
    return tabs.length > 0 ? tabs : [WidgetTabs.Home];
  }, [config.features.homeTab, config.features.messagesTab, config.features.contactTab]);

  useEffect(() => {
    if (!enabledTabs.includes(activeTab) && activeTab !== WidgetTabs.Contact) {
      switchTab(enabledTabs[0]!);
    }
  }, [activeTab, enabledTabs, switchTab]);

  const isRootScreen = tabStacks[activeTab]?.stack.length === 1;
  const currentScreen = tabStacks[activeTab]?.stack.at(-1);
  const ActiveScreen = currentScreen ? getScreenComponent(activeTab, currentScreen.name) : null;
  const showTabBar = isRootScreen && enabledTabs.length > 1;

  return (
    <div
      data-neylonai-widget
      className={cn(
        widgetPanelClassName(isOpen, isCollapse, config.branding.fontClassName, inline, isLeft),
        !showTabBar && "pb-1.5 max-md:pb-0",
      )}
      style={{
        fontFamily,
        backgroundImage: `linear-gradient(to bottom, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        backgroundColor: gradientTo,
        ...(inline ? { bottom: panelBottomPx } : ({ ["--neylonai-panel-bottom" as string]: `${panelBottomPx}px` } as React.CSSProperties)),
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
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
                style={{ color: selected ? tabActiveColor : accentColor }}
              >
                {configTab.icon}
                <span className="text-[11px] font-medium leading-none">{configTab.label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
