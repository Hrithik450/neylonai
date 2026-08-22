import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WidgetScreenType, WidgetTabType } from "../constants";
import { WidgetTabs, WidgetScreens } from "../constants";

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
  /** True while assistant tokens are actively painting. */
  isStreaming: boolean;
  /** Live tips from the server; empty → fall back to static defaults. */
  thinkingTips: string[];

  setAssistantTyping: (value: boolean) => void;
  setIsStreaming: (value: boolean) => void;
  setThinkingTips: (tips: string[]) => void;
}

export const useWidgetStore = create<WidgetStore>((set) => ({
  assistantTyping: false,
  isStreaming: false,
  thinkingTips: [],

  setAssistantTyping: (value) => set({ assistantTyping: value }),
  setIsStreaming: (value) => set({ isStreaming: value }),
  setThinkingTips: (tips) => set({ thinkingTips: tips }),
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
  /** Replaces the top screen on a tab (same name, new props) without growing the stack. */
  replaceTopScreen: (tab: WidgetTabType, screen: WidgetScreen) => void;
  popScreen: (tab: WidgetTabType) => void;
  /** Jump to a fresh message screen (no threads list underneath). */
  openNewChat: () => void;
}

export const useWidgetNavigationStore = create<WidgetNavigationStore>()(
  devtools((set) => ({
    activeTab: WidgetTabs.Home,
    tabStacks: {
      [WidgetTabs.Home]: { stack: [{ name: WidgetScreens.HomeScreens.Home }] },
      [WidgetTabs.Messages]: {
        stack: [{ name: WidgetScreens.MessagesScreens.Threads }],
      },
      [WidgetTabs.Contact]: {
        stack: [{ name: WidgetScreens.ContactScreens.Contact }],
      },
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
    replaceTopScreen: (tab, screen) =>
      set((state) => {
        const stack = state.tabStacks[tab].stack;
        if (stack.length === 0) {
          return {
            tabStacks: {
              ...state.tabStacks,
              [tab]: { stack: [screen] },
            },
          };
        }
        return {
          tabStacks: {
            ...state.tabStacks,
            [tab]: {
              stack: [...stack.slice(0, -1), screen],
            },
          },
        };
      }),
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
    openNewChat: () =>
      set((state) => ({
        activeTab: WidgetTabs.Messages,
        tabStacks: {
          ...state.tabStacks,
          // Keep Threads under Messages so chat is not a root screen
          // (root screens show the bottom tab bar).
          [WidgetTabs.Messages]: {
            stack: [
              { name: WidgetScreens.MessagesScreens.Threads },
              { name: WidgetScreens.MessagesScreens.Messages },
            ],
          },
        },
      })),
    switchTab: (tab) => set({ activeTab: tab }),
  })),
);
