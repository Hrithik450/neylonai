"use client";

import { useCallback } from "react";
import {
  useWidgetToggleStore,
  useWidgetNavigationStore,
} from "./store/widget-store";
import { useWidgetNavigation } from "./hooks/use-widget-navigation";
import type { WidgetScreenType, WidgetTabType } from "./constants";

export function useSupportWidget() {
  const { isOpen, setIsOpen, setCollapse } = useWidgetToggleStore();
  const { switchTab } = useWidgetNavigationStore();
  const { navigate, back } = useWidgetNavigation();

  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  const toggle = useCallback(() => setIsOpen(!isOpen), [isOpen, setIsOpen]);

  return {
    isOpen,
    open,
    close,
    toggle,
    setCollapse,
    switchTab,
    navigate: (
      tab: WidgetTabType,
      screen: WidgetScreenType,
      props?: Record<string, unknown>,
    ) => navigate(tab, screen, props),
    back,
  };
}
