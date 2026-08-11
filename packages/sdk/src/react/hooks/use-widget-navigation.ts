"use client";

import { useCallback } from "react";
import { useWidgetNavigationStore } from "../store/widget-store";
import { WidgetScreenType, WidgetTabType } from "../constants";

/**
 * Public navigation API for widget screens.
 * Prefer this over calling the Zustand store directly from UI.
 */
export function useWidgetNavigation() {
  const { activeTab, pushScreen, replaceTopScreen, popScreen, switchTab } =
    useWidgetNavigationStore();

  const navigate = useCallback(
    (
      tab: WidgetTabType,
      screen: WidgetScreenType,
      props?: Record<string, unknown>,
    ) => {
      switchTab(tab);

      const stack = useWidgetNavigationStore.getState().tabStacks[tab].stack;
      const top = stack.at(-1);

      // Same screen already on top → refresh props instead of stacking a duplicate.
      if (top?.name === screen) {
        replaceTopScreen(tab, { name: screen, props });
        return;
      }

      pushScreen(tab, {
        name: screen,
        props,
      });
    },
    [switchTab, pushScreen, replaceTopScreen],
  );

  const back = useCallback(() => {
    popScreen(activeTab);
  }, [activeTab, popScreen]);

  return {
    back,
    navigate,
  };
}
