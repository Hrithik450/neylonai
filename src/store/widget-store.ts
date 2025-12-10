import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WidgetScreenType, WidgetTabType } from "@/lib/constants";
import { WidgetTabs, WidgetScreens, thinkingPhases } from "@/lib/constants";

interface WidgetToggleStore {
  isOpen: boolean;
  isCollapse: boolean;

  setIsOpen: (flag: boolean) => void;
  setCollapse: (flag: boolean) => void;
}

export const useWidgetToggleStore = create<WidgetToggleStore>((set) => ({
  isOpen: false,
  isCollapse: true,

  setIsOpen: (flag) => set({ isOpen: flag }),
  setCollapse: (flag) => set({ isCollapse: flag }),
}));

interface WidgetStore {
  assistantTyping: boolean;
  thinkingPhase: keyof typeof thinkingPhases;

  setAssistantTyping: (value: boolean) => void;
  setThinkingPhase: (value: keyof typeof thinkingPhases) => void;
}

export const useWidgetStore = create<WidgetStore>((set) => ({
  assistantTyping: false,
  thinkingPhase: "default",

  setThinkingPhase: (value) => set({ thinkingPhase: value }),
  setAssistantTyping: (value) => set({ assistantTyping: value }),
}));

interface WidgetScreen {
  name: WidgetScreenType;
  props?: Record<string, unknown>;
}

interface WidgetNavigationStore {
  activeTab: WidgetTabType;
  tabStacks: Record<WidgetTabType, { stack: WidgetScreen[] }>;
  switchTab: (tab: WidgetTabType) => void;
  pushScreen: (tab: WidgetTabType, screen: WidgetScreen) => void;
  popScreen: (tab: WidgetTabType) => void;
}

export const useWidgetNavigationStore = create<WidgetNavigationStore>()(
  devtools((set) => ({
    activeTab: WidgetTabs.Home,
    tabStacks: {
      [WidgetTabs.Home]: { stack: [{ name: WidgetScreens.HomeScreens.Home }] },
      [WidgetTabs.Messages]: {
        stack: [{ name: WidgetScreens.MessagesScreens.Threads }],
      },
      // [WidgetTabs.Contact]: {
      //   stack: [{ name: WidgetScreens.ContactScreens.Contact }],
      // },
      // [WidgetTabs.Settings]: {
      //   stack: [{ name: WidgetScreens.SettingsScreens.Settings }],
      // },
    },
    pushScreen: (tab, screen) =>
      set((state) => ({
        tabStacks: {
          ...state.tabStacks,
          [tab]: {
            stack: [...state.tabStacks[tab].stack, screen],
          },
        },
      })),
    popScreen: (tab) =>
      set((state) => ({
        tabStacks: {
          ...state.tabStacks,
          [tab]: {
            stack:
              state.tabStacks[tab].stack.length > 1
                ? state.tabStacks[tab].stack.slice(0, -1)
                : state.tabStacks[tab].stack,
          },
        },
      })),
    switchTab: (tab) => set({ activeTab: tab }),
  })),
);
