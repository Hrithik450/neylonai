"use client";

import {
  TabType,
  type Screen,
  type TabState,
  useNavigationStore,
  useSupportWidgetToggleStore,
  useUserStore,
  useErrorStore,
} from "@/store/store";
import React from "react";
import { cn } from "@/lib/utils";
import { guminertRegular } from "@/assets/fonts";
import { ClassicLoader } from "@/components/classic-loader";
import { House, MessageSquareText, Mail, Settings } from "lucide-react";
import { WidgetHome } from "@/components/support-widget/tabs/widget-home";
import { WigetContact } from "@/components/support-widget/tabs/widget-contact";
import { WidgetAssistant } from "@/components/support-widget/tabs/widget-messages";
import { WidgetLogin } from "@/components/support-widget/tabs/widget-screens/widget-login";
import { WidgetSettings } from "@/components/support-widget/tabs/widget-settings";
import { useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/session-store";

export interface TabConfig {
  label: TabType;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
}

const TAB_CONFIG: Record<TabType, TabConfig> = {
  Home: {
    icon: <House className="w-6 h-6" />,
    label: TabType.Home,
    component: WidgetHome,
  },
  Messages: {
    icon: <MessageSquareText className="w-6 h-6" />,
    label: TabType.Messages,
    component: WidgetAssistant,
  },
  Contact: {
    icon: <Mail className="w-6 h-6" />,
    label: TabType.Contact,
    component: WigetContact,
  },
  Settings: {
    icon: <Settings className="w-6 h-6" />,
    label: TabType.Settings,
    component: WidgetSettings,
  },
} as const;

/* -------------------------------------------------------------------------- */
/*                              Main Component                                */
/* -------------------------------------------------------------------------- */
export function SupportWidget() {
  const searchParams = useSearchParams();
  const loggedIn = searchParams.get("auth");
  const { user, isAuthenticated } = useSessionStore();

  const [loading, setLoading] = React.useState<boolean>(false);
  const { setMessage, setStatus } = useErrorStore();
  const { isOpen, isCollapse } = useSupportWidgetToggleStore();
  const { setTokens, setRole, setAssistant, setResumeTokens, currentUserId } =
    useUserStore();
  const {
    activeTab,
    tabStacks,
    setTabStacks,
    pushScreen,
    popScreen,
    switchTab,
  } = useNavigationStore();

  const isRootLevel = tabStacks[activeTab]?.stack.length <= 1;
  const [visited, setVisited] = React.useState<Set<TabType>>(
    new Set<TabType>([TabType.Home]),
  );

  // React.useEffect(() => {
  //   const fetchUser = async (id: number) => {
  //     try {
  //       setLoading(true);
  //       const response = await fetch(
  //         `${process.env.NEXT_PUBLIC_BACKEND_URL}/core-manager/api/v1/user/${id}/`,
  //       );
  //       const data = await response.json();

  //       if (!data.success) {
  //         console.error("Error fetching user details:", data.error);
  //         return;
  //       }

  //       if (data.data) {
  //         setLoading(false);
  //         setRole(data.data.role);
  //         setTokens(data.data.daily_limit);
  //         setAssistant(data.data.assistant);
  //         setResumeTokens(data.data.resume_generation_limit);
  //       }
  //     } catch (error) {
  //       console.error("Fetch error:", error);
  //       setLoading(false);
  //     }
  //   };

  //   if (user && !currentUserId) fetchUser(user.id);
  // }, [isAuthenticated]);

  // Initialize default screens
  React.useEffect(() => {
    const initialStacks: Record<TabType, TabState> = Object.values(
      TAB_CONFIG,
    ).reduce(
      (acc, tab) => {
        acc[tab.label] = { stack: [{ component: tab.component }] };
        return acc;
      },
      {} as Record<TabType, TabState>,
    );

    setTabStacks(initialStacks);
  }, [setTabStacks]);

  React.useEffect(() => {
    if (loggedIn === "false")
      pushScreen(TabType.Home, { component: WidgetLogin });
  }, [loggedIn]);

  const handleTabChange = React.useCallback(
    (tab: TabType) => {
      if (
        (tab === TabType.Messages || tab === TabType.Settings) &&
        !isAuthenticated
      ) {
        pushScreen(TabType.Home, { component: WidgetLogin });
        return;
      }

      switchTab(tab);
      setVisited((prev) => new Set(prev).add(tab));
    },
    [switchTab, isAuthenticated],
  );

  if (loading) {
    return (
      <div
        className={cn(
          guminertRegular.className,
          "fixed max-md:inset-0 overflow-y-auto",
          "bottom-0 md:bottom-16 md:right-5",
          "2xl:right-[max(1.2rem,calc((100vw-120rem)/2+2rem))]",
          "md:h-[65vh] lg:h-[85vh] max-h-full md:max-h-[750px] z-99",
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
        "md:h-[65vh] lg:h-[85vh] max-h-full md:max-h-[750px] z-99",
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
        {(Object.entries(TAB_CONFIG) as Array<[TabType, TabConfig]>).map(
          ([tab, config]) => {
            const isActive = tab === activeTab;
            if (!visited.has(tab) && !isActive) return null;

            const stack = tabStacks[tab]?.stack ?? [
              { component: config.component },
            ];
            const ActiveScreen =
              stack[stack.length - 1]?.component ?? (() => null);
            const screenProps = {
              pushScreen: (tab: TabType, screen: Screen) =>
                pushScreen(tab, screen),
              popScreen: () => popScreen(activeTab),
              ...stack[stack.length - 1]?.props,
              switchTab,
              setMessage,
              setStatus,
            };

            return (
              <div
                key={tab}
                className={cn("w-full h-full", isActive ? "block" : "hidden")}
              >
                <ActiveScreen {...screenProps} />
              </div>
            );
          },
        )}
      </div>

      {/* Navigation */}
      {isRootLevel && (
        <nav className="border-t flex justify-around pt-3">
          {(Object.entries(TAB_CONFIG) as Array<[TabType, TabConfig]>).map(
            ([tab, config]) => (
              <button
                key={config.label}
                onClick={() => handleTabChange(tab)}
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
            ),
          )}
        </nav>
      )}
    </div>
  );
}
