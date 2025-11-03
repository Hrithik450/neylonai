"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { guminertRegular } from "@/assets/fonts";
import { ClassicLoader } from "@/components/classic-loader";
import { House, MessageSquareText, Mail, Settings } from "lucide-react";

import { WidgetScreens, WidgetTabs } from "@/lib/constants";
import type { WidgetScreenType, WidgetTabType } from "@/lib/constants";

import { WidgetHome } from "@/components/widget/widget-tabs/widget-home";
import { WigetContact } from "@/components/widget/widget-tabs/widget-contact";
import { WidgetSettings } from "@/components/widget/widget-tabs/widget-settings";
import { WidgetThreads } from "@/components/widget/widget-tabs/widget-threads";

import {
  useWidgetToggleStore,
  useWidgetNavigationStore,
} from "@/store/widget-store";
import { WidgetMessages } from "@/components/widget/widget-screens/widget-messages";

// Make sure to add default screen into tabStacks of zustand store after modifying registry.
// Because less coupling is done for developer friendly.
const TabsRegistry = {
  Home: {
    icon: <House className="w-6 h-6" />,
    label: WidgetTabs.Home,
    screens: {
      [WidgetScreens.HomeScreens.Home]: WidgetHome,
    },
    default: WidgetScreens.HomeScreens.Home,
  },
  Messages: {
    icon: <MessageSquareText className="w-6 h-6" />,
    label: WidgetTabs.Messages,
    screens: {
      [WidgetScreens.MessagesScreens.Threads]: WidgetThreads,
      [WidgetScreens.MessagesScreens.Messages]: WidgetMessages,
    },
    default: WidgetScreens.MessagesScreens.Messages,
  },
  // Contact: {
  //   icon: <Mail className="w-6 h-6" />,
  //   label: WidgetTabs.Contact,
  //   screens: {
  //     [WidgetScreens.ContactScreens.Contact]: WigetContact,
  //   },
  //   default: WidgetScreens.ContactScreens.Contact,
  // },
  // Settings: {
  //   icon: <Settings className="w-6 h-6" />,
  //   label: WidgetTabs.Settings,
  //   screens: {
  //     [WidgetScreens.SettingsScreens.Settings]: WidgetSettings,
  //   },
  //   default: WidgetScreens.SettingsScreens.Settings,
  // },
} as const;

/* -------------------------------------------------------------------------- */
/*                              Main Component                                */
/* -------------------------------------------------------------------------- */
function getScreenComponent(tab: WidgetTabType, screenName: WidgetScreenType) {
  return (
    TabsRegistry[tab].screens as Record<string, React.ComponentType<any>>
  )[screenName];
}

export function Widget() {
  const [loading, setLoading] = React.useState<boolean>(false);

  const { isOpen, isCollapse } = useWidgetToggleStore();
  const { activeTab, tabStacks, switchTab } = useWidgetNavigationStore();

  const isRootScreen = tabStacks[activeTab]?.stack.length == 1;
  const currentScreen = tabStacks[activeTab]?.stack.at(-1);
  const ActiveScreen = currentScreen
    ? getScreenComponent(activeTab, currentScreen.name)
    : null;

  if (loading) {
    return (
      <div
        className={cn(
          guminertRegular.className,
          "fixed max-md:inset-0 overflow-y-auto",
          "bottom-0 md:bottom-16 md:right-5",
          "2xl:right-[max(1.2rem,calc((100vw-120rem)/2+2rem))]",
          "md:h-[65vh] lg:h-[85vh] max-h-full md:max-h-187.5 z-99",
          "bg-[linear-gradient(to_bottom,rgb(144,238,144)_0%,white_100%)]",
          "border border-gray-400/40 shadow-2xl sm:rounded-2xl py-2 sm:py-3 flex flex-col",
          "origin-bottom-right transition-all duration-300 transform",
          "flex flex-col justify-center items-center",
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-0 pointer-events-none",
          isCollapse
            ? "w-full md:min-w-md md:max-w-md"
            : "w-full md:min-w-2xl md:max-w-2xl",
        )}
      >
        <ClassicLoader />
      </div>
    );
  }

  return (
    <div
      className={cn(
        guminertRegular.className,
        "fixed max-md:inset-0 overflow-y-auto",
        "bottom-0 md:bottom-16 md:right-5",
        "2xl:right-[max(1.2rem,calc((100vw-120rem)/2+2rem))]",
        "md:h-[65vh] lg:h-[85vh] max-h-full md:max-h-187.5 z-99",
        "bg-[linear-gradient(to_bottom,rgb(144,238,144)_0%,white_100%)]",
        "border border-gray-400/40 shadow-2xl sm:rounded-2xl py-2 sm:py-3 flex flex-col",
        "origin-bottom-right transition-all duration-300 transform",
        isOpen
          ? "opacity-100 scale-100"
          : "opacity-0 scale-0 pointer-events-none",
        isCollapse
          ? "w-full md:min-w-md md:max-w-md"
          : "w-full md:min-w-2xl md:max-w-2xl",
      )}
    >
      {/* Active Screen */}
      <div className="relative flex-1 w-full h-full overflow-x-hidden overflow-y-auto scrollbar-hide">
        {ActiveScreen && <ActiveScreen {...currentScreen?.props} />}
      </div>

      {/* Navigation */}
      {isRootScreen && (
        <nav className="border-t flex justify-around pt-3">
          {(
            Object.entries(TabsRegistry) as Array<
              [WidgetTabType, (typeof TabsRegistry)[WidgetTabType]]
            >
          ).map(([tab, config]) => (
            <button
              key={config.label}
              onClick={() => switchTab(tab)}
              className={cn(
                "flex-1 flex flex-col items-center cursor-pointer",
                tab === activeTab
                  ? "text-purple-600"
                  : "text-gray-500 hover:text-purple-400",
              )}
            >
              {config.icon}
              <span className="text-sm">{config.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
