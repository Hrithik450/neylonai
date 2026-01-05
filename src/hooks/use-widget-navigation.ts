"use client";

import { useCallback } from "react";
import { useWidgetNavigationStore } from "@/store/widget-store";
import { WidgetScreenType, WidgetTabType } from "@/lib/constants";

export function useWidgetNavigation() {
  const { activeTab, pushScreen, popScreen, switchTab } =
    useWidgetNavigationStore();

  const navigate = useCallback(
    (
      tab: WidgetTabType,
      screen: WidgetScreenType,
      props?: Record<string, unknown>,
    ) => {
      switchTab(tab);
      pushScreen(tab, {
        name: screen,
        props,
      });
    },
    [switchTab, pushScreen],
  );

  const back = useCallback(() => {
    popScreen(activeTab);
  }, [activeTab, popScreen]);

  return {
    back,
    navigate,
  };
}
